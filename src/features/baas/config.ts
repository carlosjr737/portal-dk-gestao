import "server-only";

/**
 * Ambiente do Asaas. NUNCA aponta pra produção por padrão — precisa ser
 * explicitamente "production" via env, e mesmo assim só depois do contrato
 * de BaaS assinado.
 */
export const ASAAS_ENV = process.env.ASAAS_ENV === "production" ? "production" : "sandbox";

export const ASAAS_API_BASE =
  ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

/** Chave de API do Asaas, lida de env. NUNCA fica no repositório. */
export function getAsaasApiKey(): string | null {
  const key = process.env.ASAAS_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}
