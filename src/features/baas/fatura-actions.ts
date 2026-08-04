"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import {
  listarCobrancasAssinatura,
  obterPixCopiaECola,
} from "@/features/baas/asaas-client";
import { ASAAS_ENV } from "@/features/baas/config";

export type FaturaState = {
  ok?: boolean;
  message?: string;
  responsavel?: string;
  valor?: number;
  vencimento?: string;
  invoiceUrl?: string;
  pixCopiaECola?: string | null;
  /** Mensagem pronta para o WhatsApp, já com link. */
  textoWhatsapp?: string;
  telefone?: string | null;
};

const EM_ABERTO = ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"];

/**
 * Busca a cobrança em aberto para a escola entregar ao responsável.
 *
 * A escola entrega por conta própria: as notificações do provedor são
 * cobradas por envio, então desligamos e devolvemos aqui o link e o
 * copia-e-cola para a secretaria mandar.
 */
export async function obterFatura(contratoId: string): Promise<FaturaState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    return { ok: false, message: "Sem permissão." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { ok: false, message: "Usuário sem escola vinculada." };

  const admin = createAdminClient();

  const { data: assinatura } = await admin
    .from("aluno_assinatura")
    .select("asaas_subscription_id, escola_id, guardian_id")
    .eq("guardian_contract_id", contratoId)
    .maybeSingle();

  if (!assinatura) return { ok: false, message: "Cobrança não encontrada." };
  // Admin client ignora a RLS: confere a escola na mão.
  if (assinatura.escola_id !== escolaId) {
    return { ok: false, message: "Cobrança não pertence à sua escola." };
  }

  const { data: cred } = await admin
    .from("school_payment_credentials")
    .select("api_key")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  const apiKey = (cred?.api_key as string | undefined) ?? null;
  if (!apiKey) return { ok: false, message: "Conta de pagamentos não configurada." };

  const r = await listarCobrancasAssinatura(
    assinatura.asaas_subscription_id as string,
    apiKey,
  );
  if (!r.ok) return { ok: false, message: `Não foi possível buscar: ${r.error}` };

  // A mais antiga em aberto é a que a família precisa pagar agora.
  const aberta = r.cobrancas
    .filter((c) => EM_ABERTO.includes(c.status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  if (!aberta) {
    return { ok: false, message: "Nenhuma cobrança em aberto no momento." };
  }
  if (!aberta.invoiceUrl) {
    return { ok: false, message: "O provedor não devolveu link para esta cobrança." };
  }

  const { data: guardian } = await admin
    .from("guardians")
    .select("full_name, phone")
    .eq("id", assinatura.guardian_id as string)
    .maybeSingle();

  const { data: escola } = await admin
    .from("school")
    .select("nome")
    .eq("id", escolaId)
    .maybeSingle();

  const pix =
    aberta.billingType === "PIX" || aberta.billingType === "UNDEFINED"
      ? await obterPixCopiaECola(aberta.id, apiKey)
      : null;

  const venc = aberta.dueDate.split("-").reverse().join("/");
  const valorFmt = aberta.value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const primeiroNome = (guardian?.full_name as string | undefined)?.split(" ")[0] ?? "";

  const textoWhatsapp =
    `Olá${primeiroNome ? `, ${primeiroNome}` : ""}! ` +
    `Segue a mensalidade da ${escola?.nome ?? "escola"}: ${valorFmt}, ` +
    `com vencimento em ${venc}.\n\n${aberta.invoiceUrl}\n\n` +
    `Pelo link dá para pagar por Pix, boleto ou cartão.`;

  return {
    ok: true,
    responsavel: (guardian?.full_name as string | undefined) ?? "",
    valor: aberta.value,
    vencimento: aberta.dueDate,
    invoiceUrl: aberta.invoiceUrl,
    pixCopiaECola: pix,
    textoWhatsapp,
    telefone: (guardian?.phone as string | null) ?? null,
  };
}
