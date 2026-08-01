"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import {
  consultarStatusSubconta,
  listarDocumentosSubconta,
  type DocumentoPendente,
} from "@/features/baas/asaas-client";

export type OnboardingState = {
  ok?: boolean;
  message?: string;
  documentos?: DocumentoPendente[];
  statusGeral?: string;
  /** Itens que compõem a aprovação — mostram o que ainda falta. */
  etapas?: Array<{ nome: string; status: string }>;
};

/** Traduz o status do provedor para o vocabulário do cadastro da escola. */
function paraKycStatus(general: string): string {
  switch (general.toUpperCase()) {
    case "APPROVED":
      return "aprovada";
    case "REJECTED":
      return "recusada";
    case "AWAITING_APPROVAL":
      return "analise";
    default:
      return "analise";
  }
}

/**
 * Busca os documentos pendentes e o status da subconta, usando a chave DELA.
 *
 * O envio de documento com `onboardingUrl` acontece obrigatoriamente por esse
 * link (a API recusa upload nesses casos) — por isso a tela só expõe o link.
 */
export async function consultarOnboarding(): Promise<OnboardingState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Apenas admin pode consultar o cadastro." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) {
    return { ok: false, message: "Seu usuário não está vinculado a uma escola." };
  }

  // A credencial vive numa tabela sem policy: só o backend (service_role) lê.
  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("school_payment_credentials")
    .select("api_key")
    .eq("escola_id", escolaId)
    .maybeSingle();

  const apiKey = (cred?.api_key as string | undefined) ?? null;
  if (!apiKey) {
    return {
      ok: false,
      message: "Esta escola ainda não tem conta de pagamentos criada.",
    };
  }

  const [docs, status] = await Promise.all([
    listarDocumentosSubconta(apiKey),
    consultarStatusSubconta(apiKey),
  ]);

  if (!docs.ok) {
    return { ok: false, message: `Não foi possível listar os documentos: ${docs.error}` };
  }
  if (!status.ok) {
    return { ok: false, message: `Não foi possível consultar o status: ${status.error}` };
  }

  // Espelha o status do provedor no cadastro, para a UI não depender de
  // consultar a API toda vez.
  await admin
    .from("school")
    .update({
      kyc_status: paraKycStatus(status.general),
      updated_at: new Date().toISOString(),
    })
    .eq("id", escolaId);

  revalidatePath("/configuracoes/escola");

  const pendentes = docs.documentos.filter(
    (d) => d.status.toUpperCase() !== "APPROVED",
  );

  return {
    ok: true,
    documentos: docs.documentos,
    statusGeral: status.general,
    etapas: [
      { nome: "Documentação", status: status.documentation },
      { nome: "Dados comerciais", status: status.commercialInfo },
      { nome: "Conta bancária", status: status.bankAccountInfo },
    ],
    message:
      status.general.toUpperCase() === "APPROVED"
        ? "Cadastro aprovado — a conta já pode receber."
        : pendentes.length === 0
          ? "Cadastro em análise, sem pendências suas."
          : `${pendentes.length} item(ns) de documentação a enviar.`,
  };
}
