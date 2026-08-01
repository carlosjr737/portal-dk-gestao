import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Traduz o evento do provedor para o status da assinatura.
 *
 * Retorna null para evento que não muda status (ex.: PAYMENT_CREATED) — o
 * evento ainda é gravado, mas nada é alterado.
 */
function statusPorEvento(event: string): string | null {
  switch (event) {
    // Pago. CONFIRMED = pagamento efetuado (saldo ainda não liberado);
    // RECEIVED = valor já disponível. Para liberar acesso, confirmado basta.
    // A baixa manual (receiveInCash) também dispara PAYMENT_RECEIVED —
    // confirmado no sandbox. Não existe evento PAYMENT_RECEIVED_IN_CASH.
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return "ativa";

    // Baixa manual desfeita: volta a dever.
    case "PAYMENT_RECEIVED_IN_CASH_UNDONE":
      return "pendente";

    // Nova cobrança do ciclo seguinte: ainda não venceu, então continua ativa.
    // Serve para mover o próximo vencimento (ver abaixo).
    case "PAYMENT_CREATED":
      return null;

    case "PAYMENT_OVERDUE":
      return "atrasada";

    // Dinheiro devolvido ou cobrança desfeita: volta a dever.
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_REVERSED":
      return "pendente";

    default:
      return null;
  }
}

export type ResultadoProcessamento = {
  aplicado: boolean;
  detalhe: string;
};

/**
 * Processa um evento já gravado. Isolado do endpoint de propósito: o endpoint
 * precisa responder rápido e sempre 2xx, e este passo pode falhar sem que o
 * evento se perca (fica em webhook_evento com `erro` preenchido).
 */
export async function processarEventoPagamento(
  evento: {
    id: string;
    event: string;
    subscriptionId: string | null;
    paymentId: string | null;
    dueDate: string | null;
  },
): Promise<ResultadoProcessamento> {
  const admin = createAdminClient();

  const novoStatus = statusPorEvento(evento.event);
  // PAYMENT_CREATED não muda status, mas move o vencimento: é o único momento
  // em que sabemos a data da PRÓXIMA cobrança. Usar a data do evento de
  // pagamento não serve — aquela é a da cobrança que acabou de ser quitada.
  const moveVencimento = evento.event === "PAYMENT_CREATED";

  if (!novoStatus && !moveVencimento) {
    return { aplicado: false, detalhe: `evento ${evento.event} não altera status` };
  }

  if (!evento.subscriptionId) {
    return { aplicado: false, detalhe: "evento sem assinatura vinculada" };
  }

  // O mesmo evento pode ser de dois fluxos distintos:
  //   plataforma_assinatura -> a plataforma cobrando a escola
  //   aluno_assinatura      -> a escola cobrando o aluno (na subconta dela)
  // O id da assinatura diz qual é. A lógica de status é a mesma nos dois.
  let tabela = "plataforma_assinatura";
  let { data: assinatura } = await admin
    .from("plataforma_assinatura")
    .select("id, escola_id, status")
    .eq("asaas_subscription_id", evento.subscriptionId)
    .maybeSingle();

  if (!assinatura) {
    tabela = "aluno_assinatura";
    const r = await admin
      .from("aluno_assinatura")
      .select("id, escola_id, status")
      .eq("asaas_subscription_id", evento.subscriptionId)
      .maybeSingle();
    assinatura = r.data;
  }

  if (!assinatura) {
    return {
      aplicado: false,
      detalhe: `assinatura ${evento.subscriptionId} não encontrada`,
    };
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (novoStatus) patch.status = novoStatus;
  if (moveVencimento && evento.dueDate) patch.proximo_vencimento = evento.dueDate;

  const { error } = await admin.from(tabela).update(patch).eq("id", assinatura.id);

  if (error) {
    throw new Error(`falha ao atualizar ${tabela}: ${error.message}`);
  }

  return {
    aplicado: true,
    detalhe: novoStatus
      ? `${tabela} ${assinatura.id}: ${assinatura.status} -> ${novoStatus}`
      : `${tabela} ${assinatura.id}: próximo vencimento -> ${evento.dueDate}`,
  };
}
