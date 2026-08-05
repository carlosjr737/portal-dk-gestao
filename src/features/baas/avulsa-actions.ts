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
  criarCobrancaAvulsa,
  pixDaCobranca,
} from "@/features/baas/asaas-conta";

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
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Sem permissão." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { ok: false, message: "Usuário sem escola vinculada." };

  const guardianId = String(formData.get("guardian_id") ?? "").trim();
  const valor = paraNumero(String(formData.get("valor") ?? ""));
  const vencimento = String(formData.get("vencimento") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const formaBruta = String(formData.get("forma") ?? "BOLETO");
  const forma = formaBruta === "PIX" ? "PIX" : "BOLETO";

  if (!guardianId) return { ok: false, message: "Selecione o responsável." };
  if (!(valor > 0)) return { ok: false, message: "Informe o valor." };
  if (!vencimento) return { ok: false, message: "Informe o vencimento." };
  if (!descricao) {
    return {
      ok: false,
      message: "Descreva a cobrança — é o que a família vê ao pagar.",
    };
  }

  const admin = createAdminClient();

  const [{ data: cred }, { data: guardian }] = await Promise.all([
    admin
      .from("school_payment_credentials")
      .select("api_key")
      .eq("escola_id", escolaId)
      .eq("environment", ASAAS_ENV)
      .maybeSingle(),
    admin
      .from("guardians")
      .select("id, full_name, phone, escola_id")
      .eq("id", guardianId)
      .maybeSingle(),
  ]);

  const chave = (cred?.api_key as string | undefined) ?? null;
  if (!chave) {
    return { ok: false, message: "Conta de pagamentos não configurada." };
  }
  if (!guardian) return { ok: false, message: "Responsável não encontrado." };
  // O admin client ignora RLS: a fronteira de escola é conferida na mão.
  if (guardian.escola_id !== escolaId) {
    return { ok: false, message: "Responsável não pertence à sua escola." };
  }

  /*
   * O cliente no provedor é REAPROVEITADO da assinatura, quando existe.
   *
   * Criar outro com o mesmo CPF duplicaria a pessoa lá dentro, e aí a mesma
   * família apareceria duas vezes na lista de cobranças do provedor — com
   * históricos separados que nunca mais se juntam.
   */
  const { data: assinatura } = await admin
    .from("aluno_assinatura")
    .select("asaas_customer_id")
    .eq("guardian_id", guardianId)
    .not("asaas_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  const customerId = (assinatura?.asaas_customer_id as string | undefined) ?? null;
  if (!customerId) {
    return {
      ok: false,
      message:
        `${guardian.full_name} ainda não tem cadastro no provedor. ` +
        "Gere a mensalidade dele uma vez antes de emitir uma cobrança avulsa.",
    };
  }

  const r = await criarCobrancaAvulsa(chave, {
    customer: customerId,
    valor,
    vencimento,
    descricao,
    forma,
    externalReference: `avulsa:${guardianId}`,
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
  const pix = await pixDaCobranca(chave, r.id);

  revalidatePath("/financeiro/conta");
  revalidatePath("/financeiro/recebimentos");

  return {
    ok: true,
    cobranca: {
      id: r.id,
      valor,
      vencimento,
      descricao,
      pagador: guardian.full_name as string,
      telefone: (guardian.phone as string | null) ?? null,
      invoiceUrl: r.invoiceUrl,
      pixCopiaECola: pix,
    },
  };
}
