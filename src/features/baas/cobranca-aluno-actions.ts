"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import {
  criarAssinaturaAsaas,
  criarClienteAsaas,
  type FormaPagamento,
} from "@/features/baas/asaas-client";
import { ASAAS_ENV } from "@/features/baas/config";
import { motivoDocumentoInvalido } from "@/lib/documento";

export type CobrancaAlunoState = {
  ok?: boolean;
  message?: string;
};

/**
 * Liga a cobrança recorrente da mensalidade para um contrato de responsável.
 *
 * O QUE FAZ ESTE FLUXO SER DIFERENTE DA ASSINATURA DA PLATAFORMA:
 * tudo aqui roda com a chave DA SUBCONTA da escola. O cliente e a assinatura
 * são criados dentro dela, e o dinheiro cai lá — sem transitar pela conta da
 * plataforma nem por um instante. É essa separação que mantém a plataforma
 * fora do escopo de instituição de pagamento (Res. 16, Art. 4º §4º).
 */
export async function criarCobrancaAluno(
  _prev: CobrancaAlunoState,
  formData: FormData,
): Promise<CobrancaAlunoState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    return { ok: false, message: "Sem permissão." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { ok: false, message: "Usuário sem escola vinculada." };

  const contratoId = String(formData.get("contrato_id") ?? "");
  if (!contratoId) return { ok: false, message: "Contrato não informado." };

  // Só aceita forma conhecida; valor inesperado cai no padrão em vez de ir
  // cru para o provedor.
  //
  // O PADRÃO É BOLETO, e não UNDEFINED. Uma cobrança BOLETO sai com boleto E
  // Pix na mesma fatura — conferido na API — e sem cartão. UNDEFINED oferece
  // o que estiver habilitado NA CONTA, e é por ali que o cartão volta.
  const FORMAS: readonly FormaPagamento[] = ["BOLETO", "PIX"];
  const enviado = String(formData.get("billing_type") ?? "");
  const billingType: FormaPagamento = FORMAS.includes(enviado as FormaPagamento)
    ? (enviado as FormaPagamento)
    : "BOLETO";

  const admin = createAdminClient();

  const [{ data: contrato }, { data: cred }, { data: jaExiste }] = await Promise.all([
    admin
      .from("guardian_financial_contracts")
      .select("id, guardian_id, total_amount, first_due_date, escola_id")
      .eq("id", contratoId)
      .maybeSingle(),
    admin
      .from("school_payment_credentials")
      .select("api_key, environment")
      .eq("escola_id", escolaId)
      .eq("environment", ASAAS_ENV)
      .maybeSingle(),
    admin
      .from("aluno_assinatura")
      .select("id")
      .eq("guardian_contract_id", contratoId)
      .maybeSingle(),
  ]);

  if (!contrato) return { ok: false, message: "Contrato não encontrado." };
  // Trava de escola: o admin client ignora a RLS, então checa na mão.
  if (contrato.escola_id !== escolaId) {
    return { ok: false, message: "Contrato não pertence à sua escola." };
  }
  if (jaExiste) {
    return { ok: false, message: "Este contrato já tem cobrança recorrente ativa." };
  }

  /*
   * A credencial já vem filtrada pelo ambiente atual, então chave de sandbox
   * contra a URL de produção deixou de ser possível — não existe a linha
   * errada para carregar. Sem conta NESTE ambiente, cai na mensagem abaixo, e
   * o formulário de criar conta está de fato disponível lá.
   */
  const apiKey = (cred?.api_key as string | undefined) ?? null;
  if (!apiKey) {
    return {
      ok: false,
      message:
        "A escola ainda não tem conta de pagamentos. Crie em Sistema > Minha escola.",
    };
  }

  const valor = Number(contrato.total_amount);
  if (!(valor > 0)) {
    return { ok: false, message: "O contrato não tem valor mensal definido." };
  }

  const { data: guardian } = await admin
    .from("guardians")
    .select("id, full_name, document, email, phone")
    .eq("id", contrato.guardian_id as string)
    .maybeSingle();

  if (!guardian) return { ok: false, message: "Responsável financeiro não encontrado." };

  /*
   * Documento conferido AQUI, e não no provedor.
   *
   * Sem isto, um RG no lugar do CPF só aparecia como "O CPF/CNPJ informado é
   * inválido" vindo do Asaas — sem dizer de quem era o documento, nem onde
   * arrumar, e meses depois do cadastro. Ver `src/lib/documento.ts`.
   */
  const motivo = motivoDocumentoInvalido(guardian.document);
  if (motivo) {
    return {
      ok: false,
      message: `${guardian.full_name} ${motivo}. Corrija em Responsáveis antes de gerar a cobrança.`,
    };
  }

  const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

  // Cliente DENTRO da subconta da escola.
  const cliente = await criarClienteAsaas(
    {
      name: guardian.full_name as string,
      cpfCnpj: soDigitos(guardian.document),
      email: (guardian.email as string | null) ?? undefined,
      mobilePhone: soDigitos(guardian.phone) || undefined,
      externalReference: guardian.id as string,
      // A escola entrega a cobrança (link/WhatsApp). Deixar o provedor
      // notificar custaria ~R$ 0,50 por envio, e o padrão dele é vir LIGADO.
      notificationDisabled: true,
    },
    apiKey,
  );

  if (!cliente.ok) {
    return { ok: false, message: `Não foi possível cadastrar o responsável: ${cliente.error}` };
  }

  // Primeiro vencimento: o do contrato, se ainda estiver no futuro; senão,
  // o mesmo dia do mês que vem — não faz sentido nascer vencida.
  const hoje = new Date().toISOString().slice(0, 10);
  let primeiroVencimento = (contrato.first_due_date as string | null) ?? "";
  if (!primeiroVencimento || primeiroVencimento <= hoje) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    primeiroVencimento = d.toISOString().slice(0, 10);
  }

  const assinatura = await criarAssinaturaAsaas(
    {
      customer: cliente.id,
      value: valor,
      nextDueDate: primeiroVencimento,
      cycle: "MONTHLY",
      billingType,
      description: "Mensalidade",
      externalReference: contratoId,
      // Sem split: a plataforma não retém nada da mensalidade (decisão em
      // aberto). Ligar depois é preencher este campo — o fluxo não muda.
    },
    apiKey,
  );

  if (!assinatura.ok) {
    return { ok: false, message: `Não foi possível criar a cobrança: ${assinatura.error}` };
  }

  const { error } = await admin.from("aluno_assinatura").insert({
    escola_id: escolaId,
    guardian_contract_id: contratoId,
    guardian_id: guardian.id,
    asaas_customer_id: cliente.id,
    asaas_subscription_id: assinatura.id,
    status: "pendente",
    valor,
    proximo_vencimento: primeiroVencimento,
    forma_pagamento: billingType,
  });

  if (error) {
    console.error("BaaS: cobrança criada no provedor mas não registrada", {
      contratoId,
      subscriptionId: assinatura.id,
      error: error.message,
    });
    return {
      ok: false,
      message: `Cobrança criada no provedor (${assinatura.id}), mas falhou ao registrar aqui.`,
    };
  }

  revalidatePath("/matriculas");
  return {
    ok: true,
    message: `Cobrança recorrente criada para ${guardian.full_name}. Primeiro vencimento em ${primeiroVencimento.split("-").reverse().join("/")}.`,
  };
}
