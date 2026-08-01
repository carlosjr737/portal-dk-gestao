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

/**
 * Token que o Asaas envia no header `asaas-access-token` a cada webhook.
 * É o que prova que a chamada veio mesmo dele — sem isso, qualquer um
 * poderia forjar "pagamento recebido" e liberar acesso de graça.
 */
export function getAsaasWebhookToken(): string | null {
  const t = process.env.ASAAS_WEBHOOK_TOKEN;
  return t && t.trim().length > 0 ? t.trim() : null;
}
