"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { atualizarCobrancaAsaas } from "@/features/baas/asaas-client";
import { ASAAS_ENV } from "@/features/baas/config";

export type MensalidadeState = {
  ok?: boolean;
  message?: string;
};

/**
 * Ajuste pontual de uma parcela já emitida no provedor.
 *
 * Vale só para a parcela clicada. O combinado do contrato não muda — quem faz
 * isso é a assinatura, em `atualizarAssinaturaAsaas`. A separação é
 * proposital: "esse mês a família pagou metade" não pode virar meia
 * mensalidade para sempre porque alguém usou a tela errada.
 */
export async function editarCobrancaAsaas(
  _prev: MensalidadeState,
  formData: FormData,
): Promise<MensalidadeState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    return { ok: false, message: "Sem permissão." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { ok: false, message: "Usuário sem escola vinculada." };

  const paymentId = String(formData.get("payment_id") ?? "");
  const contratoId = String(formData.get("contrato_id") ?? "");
  const vencimento = String(formData.get("vencimento") ?? "");
  const billingType = String(formData.get("billing_type") ?? "") || "UNDEFINED";
  const studentId = String(formData.get("student_id") ?? "");
  const valor = Number(String(formData.get("valor") ?? "").replace(",", "."));

  if (!paymentId || !contratoId) {
    return { ok: false, message: "Cobrança não informada." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
    return { ok: false, message: "Informe uma data de vencimento válida." };
  }
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, message: "Informe um valor maior que zero." };
  }

  const admin = createAdminClient();

  const [{ data: assinatura }, { data: cred }] = await Promise.all([
    admin
      .from("aluno_assinatura")
      .select("escola_id")
      .eq("guardian_contract_id", contratoId)
      .maybeSingle(),
    admin
      .from("school_payment_credentials")
      .select("api_key")
      .eq("escola_id", escolaId)
      .eq("environment", ASAAS_ENV)
      .maybeSingle(),
  ]);

  if (!assinatura) return { ok: false, message: "Cobrança não encontrada." };
  // Admin client ignora a RLS: a trava de escola é conferida na mão.
  if (assinatura.escola_id !== escolaId) {
    return { ok: false, message: "Cobrança não pertence à sua escola." };
  }

  const apiKey = (cred?.api_key as string | undefined) ?? null;
  if (!apiKey) {
    return { ok: false, message: "Conta de pagamentos não configurada." };
  }

  const r = await atualizarCobrancaAsaas(
    paymentId,
    { value: valor, dueDate: vencimento, billingType },
    apiKey,
  );

  if (!r.ok) {
    return { ok: false, message: `Não foi possível alterar: ${r.error}` };
  }

  if (studentId) revalidatePath(`/alunos/${studentId}`);
  revalidatePath("/financeiro/recebimentos");
  revalidatePath("/financeiro/inadimplencia");

  return { ok: true, message: "Cobrança atualizada no provedor." };
}
