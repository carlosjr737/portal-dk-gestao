"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { ASAAS_ENV } from "@/features/baas/config";
import {
  buscarClientes,
  clientePorDocumento,
  criarCobrancaAvulsa,
  pixDaCobranca,
  type ClienteBusca,
} from "@/features/baas/asaas-conta";
import { criarClienteAsaas } from "@/features/baas/asaas-client";
import { motivoDocumentoInvalido } from "@/lib/documento";

export type AvulsaState = {
  ok?: boolean;
  message?: string;
  /** Preenchido no sucesso: o que a escola precisa para entregar a cobrança. */
  cobranca?: {
    id: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: string;
    telefone: string | null;
    invoiceUrl: string;
    pixCopiaECola: string | null;
  };
};

async function contexto() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { erro: "Sem permissão." as const };
  }
  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { erro: "Usuário sem escola vinculada." as const };

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("school_payment_credentials")
    .select("api_key")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  const chave = (cred?.api_key as string | undefined) ?? null;
  if (!chave) return { erro: "Conta de pagamentos não configurada." as const };
  return { chave, escolaId, admin };
}

/** Busca usada pelo campo "Cobrar de", a cada tecla. */
export async function buscarPagadores(termo: string): Promise<ClienteBusca[]> {
  const ctx = await contexto();
  if ("erro" in ctx) return [];
  return buscarClientes(ctx.chave, termo);
}

function paraNumero(valor: string): number {
  const limpo = valor.replace(/[^\d,.-]/g, "");
  if (!limpo) return NaN;
  return Number(limpo.replace(/\./g, "").replace(",", "."));
}

/**
 * Cria uma cobrança única para um responsável.
 *
 * NÃO CRIA NEM ALTERA MATRÍCULA, e não vira assinatura. É o ponto que
 * diferencia isto da mensalidade: assinatura se repete todo mês, e reemitir
 * uma cobrança estornada como assinatura cobraria a família para sempre.
 *
 * O caso de origem é justamente esse — uma mensalidade estornada que precisa
 * voltar a ser cobrada, sem que a matrícula seja tocada.
 */
export async function criarAvulsa(
  _prev: AvulsaState,
  formData: FormData,
): Promise<AvulsaState> {
  const ctx = await contexto();
  if ("erro" in ctx) return { ok: false, message: ctx.erro };

  const valor = paraNumero(String(formData.get("valor") ?? ""));
  const vencimento = String(formData.get("vencimento") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const forma = String(formData.get("forma") ?? "BOLETO") === "PIX" ? "PIX" : "BOLETO";

  if (!(valor > 0)) return { ok: false, message: "Informe o valor." };
  if (!vencimento) return { ok: false, message: "Informe o vencimento." };
  if (!descricao) {
    return {
      ok: false,
      message: "Descreva a cobrança — é o que a família vê ao pagar.",
    };
  }

  /*
   * Dois caminhos: escolher alguém que já existe, ou cadastrar na hora.
   *
   * O segundo existe porque nem todo mundo que paga é responsável de aluno —
   * um ex-aluno comprando figurino, uma escola parceira, alguém de fora do
   * cadastro. Obrigar a virar responsável primeiro sujaria a base de
   * responsáveis com gente que não responde por ninguém.
   */
  let customerId = String(formData.get("customer_id") ?? "").trim();
  let nomePagador = String(formData.get("customer_nome") ?? "").trim();
  let telefonePagador: string | null = null;

  if (!customerId) {
    const nome = String(formData.get("novo_nome") ?? "").trim();
    const documento = String(formData.get("novo_documento") ?? "").trim();
    const email = String(formData.get("novo_email") ?? "").trim();
    const telefone = String(formData.get("novo_telefone") ?? "").trim();

    if (!nome) {
      return { ok: false, message: "Escolha quem vai pagar ou cadastre alguém." };
    }

    // O provedor exige documento válido para emitir. Conferido aqui para a
    // recusa dizer o que fazer, em vez de vir crua de lá.
    const motivo = motivoDocumentoInvalido(documento);
    if (motivo) return { ok: false, message: `Quem paga ${motivo}.` };

    const soDigitos = (v: string) => v.replace(/\D/g, "");

    // Já existe com este documento? Reaproveita — cadastrar de novo partiria
    // o histórico da pessoa em duas fichas que nunca mais se juntam.
    const existente = await clientePorDocumento(ctx.chave, documento);
    if (existente) {
      customerId = existente;
    } else {
      const criado = await criarClienteAsaas(
        {
          name: nome,
          cpfCnpj: soDigitos(documento),
          email: email || undefined,
          mobilePhone: soDigitos(telefone) || undefined,
          // A escola entrega a cobrança; cada aviso do provedor é cobrado.
          notificationDisabled: true,
        },
        ctx.chave,
      );
      if (!criado.ok) {
        return { ok: false, message: `Não foi possível cadastrar: ${criado.error}` };
      }
      customerId = criado.id;
    }

    nomePagador = nome;
    telefonePagador = telefone || null;
  }

  if (!customerId) {
    return { ok: false, message: "Escolha quem vai pagar ou cadastre alguém." };
  }

  const r = await criarCobrancaAvulsa(ctx.chave, {
    customer: customerId,
    valor,
    vencimento,
    descricao,
    forma,
    externalReference: `avulsa:${customerId}`,
  });

  if (!r.ok) return { ok: false, message: `O provedor recusou: ${r.error}` };
  if (!r.invoiceUrl) {
    return {
      ok: false,
      message: `Cobrança ${r.id} criada, mas o provedor não devolveu o link.`,
    };
  }

  // Boleto também aceita Pix na mesma fatura, então o copia-e-cola vale nos
  // dois casos — é o que a maioria das famílias usa.
  const pix = await pixDaCobranca(ctx.chave, r.id);

  // O telefone de quem já existia sai do nosso cadastro, quando houver: é o
  // que permite abrir o WhatsApp já no contato certo.
  if (!telefonePagador) {
    const { data: g } = await ctx.admin
      .from("guardians")
      .select("phone")
      .eq("escola_id", ctx.escolaId)
      .ilike("full_name", nomePagador || "")
      .limit(1)
      .maybeSingle();
    telefonePagador = (g?.phone as string | null) ?? null;
  }

  revalidatePath("/financeiro/conta");
  revalidatePath("/financeiro/recebimentos");

  return {
    ok: true,
    cobranca: {
      id: r.id,
      valor,
      vencimento,
      descricao,
      pagador: nomePagador || "quem paga",
      telefone: telefonePagador,
      invoiceUrl: r.invoiceUrl,
      pixCopiaECola: pix,
    },
  };
}
