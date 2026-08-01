import "server-only";

import { ASAAS_API_BASE, getAsaasApiKey } from "@/features/baas/config";

export type AsaasSubcontaInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  companyType: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  phone?: string;
  site?: string;
  complement?: string;
};

export type AsaasSubcontaResult =
  | {
      ok: true;
      id: string;
      walletId: string;
      apiKey: string | null;
    }
  | { ok: false; status: number; error: string };

/** Extrai a mensagem de erro do Asaas, que vem em formatos diferentes. */
function mensagemErro(data: unknown, status: number): string {
  const d = data as
    | { errors?: Array<{ description?: string }>; message?: string }
    | null;
  return (
    d?.errors?.[0]?.description ?? d?.message ?? `Erro ${status}`
  );
}

export async function criarSubcontaAsaas(
  input: AsaasSubcontaInput,
): Promise<AsaasSubcontaResult> {
  const apiKey = getAsaasApiKey();
  if (!apiKey) {
    return { ok: false, status: 0, error: "asaas_not_configured" };
  }

  const res = await fetch(`${ASAAS_API_BASE}/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, status: res.status, error: mensagemErro(data, res.status) };
  }

  return {
    ok: true,
    id: data.id as string,
    walletId: data.walletId as string,
    apiKey: (data.accessToken?.apiKey as string | undefined) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Fluxo 2 — assinatura da plataforma (plataforma cobra da escola)
//
// Usa a chave DA PLATAFORMA (env), não a da subconta: o dinheiro da assinatura
// é receita da plataforma e cai na conta dela. Não confundir com o Fluxo 1
// (escola cobra aluno, com split), que roda na subconta da escola.
// ---------------------------------------------------------------------------

export type ClienteAsaasInput = {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  province?: string;
  externalReference?: string;
};

export type ClienteAsaasResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function criarClienteAsaas(
  input: ClienteAsaasInput,
): Promise<ClienteAsaasResult> {
  const apiKey = getAsaasApiKey();
  if (!apiKey) return { ok: false, error: "asaas_not_configured" };

  const res = await fetch(`${ASAAS_API_BASE}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };
  return { ok: true, id: data.id as string };
}

export type AssinaturaAsaasInput = {
  customer: string;
  value: number;
  nextDueDate: string; // AAAA-MM-DD
  cycle: "MONTHLY" | "YEARLY";
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
  description?: string;
  externalReference?: string;
};

export type AssinaturaAsaasResult =
  | { ok: true; id: string; status: string; nextDueDate: string }
  | { ok: false; error: string };

export async function criarAssinaturaAsaas(
  input: AssinaturaAsaasInput,
): Promise<AssinaturaAsaasResult> {
  const apiKey = getAsaasApiKey();
  if (!apiKey) return { ok: false, error: "asaas_not_configured" };

  const res = await fetch(`${ASAAS_API_BASE}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) return { ok: false, error: mensagemErro(data, res.status) };
  return {
    ok: true,
    id: data.id as string,
    status: (data.status as string) ?? "ACTIVE",
    nextDueDate: (data.nextDueDate as string) ?? input.nextDueDate,
  };
}

// ---------------------------------------------------------------------------
// Onboarding / KYC da subconta
//
// ATENÇÃO: estes dois endpoints usam a chave DA SUBCONTA (não a da plataforma).
// É por isso que a api_key fica guardada em school_payment_credentials.
// ---------------------------------------------------------------------------

export type DocumentoPendente = {
  id: string;
  status: string;
  type: string;
  title: string;
  /** Quando presente, o envio é OBRIGATORIAMENTE por este link (não por API). */
  onboardingUrl: string | null;
};

export type DocumentosResult =
  | { ok: true; documentos: DocumentoPendente[] }
  | { ok: false; error: string };

export async function listarDocumentosSubconta(
  subcontaApiKey: string,
): Promise<DocumentosResult> {
  const res = await fetch(`${ASAAS_API_BASE}/myAccount/documents`, {
    headers: { access_token: subcontaApiKey },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, error: mensagemErro(data, res.status) };
  }

  const lista = (data?.data ?? []) as Array<Record<string, unknown>>;
  return {
    ok: true,
    documentos: lista.map((d) => ({
      id: d.id as string,
      status: (d.status as string) ?? "PENDING",
      type: (d.type as string) ?? "",
      title: (d.title as string) ?? "",
      onboardingUrl: (d.onboardingUrl as string | null) ?? null,
    })),
  };
}

export type StatusSubcontaResult =
  | {
      ok: true;
      /** Só é 'APPROVED' quando tudo abaixo está aprovado. */
      general: string;
      documentation: string;
      commercialInfo: string;
      bankAccountInfo: string;
    }
  | { ok: false; error: string };

export async function consultarStatusSubconta(
  subcontaApiKey: string,
): Promise<StatusSubcontaResult> {
  const res = await fetch(`${ASAAS_API_BASE}/myAccount/status`, {
    headers: { access_token: subcontaApiKey },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, error: mensagemErro(data, res.status) };
  }

  return {
    ok: true,
    general: (data?.general as string) ?? "PENDING",
    documentation: (data?.documentation as string) ?? "PENDING",
    commercialInfo: (data?.commercialInfo as string) ?? "PENDING",
    bankAccountInfo: (data?.bankAccountInfo as string) ?? "PENDING",
  };
}
