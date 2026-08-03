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
 * A subconta guardada pertence ao ambiente em que o sistema está rodando?
 *
 * A chave da subconta é emitida pelo Asaas DENTRO de um ambiente e só vale
 * nele. Como `ASAAS_API_BASE` vem de env e a chave vem do banco, virar
 * `ASAAS_ENV` sem recriar a subconta faz as duas apontarem para lugares
 * diferentes — e o Asaas responde "a chave de API informada não pertence a
 * este ambiente", texto que vazava cru para dentro da tabela de matrículas,
 * depois de a chamada já ter saído.
 *
 * A coluna `environment` já era gravada na criação; só não era consultada.
 *
 * Credencial sem ambiente registrado (gravada antes da coluna existir) passa:
 * recusar cobrança por falta de um dado que ninguém preencheu seria trocar um
 * erro obscuro por um bloqueio pior.
 */
export function conferirAmbienteDaCredencial(
  environment: string | null | undefined,
) {
  const gravado = (environment ?? "").trim();

  if (!gravado || gravado === ASAAS_ENV) {
    return { ok: true as const };
  }

  const nome = (valor: string) =>
    valor === "production" ? "produção" : "sandbox";

  /*
   * A mensagem NÃO manda recriar a conta em Minha escola: aquele formulário
   * some assim que `school.asaas_account_id` é preenchido, e não existe
   * caminho na interface para refazer a conta. Mandar o usuário para um botão
   * que não existe é pior que não dizer nada.
   */
  return {
    ok: false as const,
    message:
      `A conta de pagamentos desta escola foi criada em ${nome(gravado)} e o ` +
      `sistema está rodando em ${nome(ASAAS_ENV)}. Nenhuma cobrança é emitida ` +
      `enquanto os dois não coincidirem: é preciso alinhar o ambiente do ` +
      `sistema, ou refazer a conta no ambiente atual.`,
  };
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
