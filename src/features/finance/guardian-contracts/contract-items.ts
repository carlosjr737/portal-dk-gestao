import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Contrato consolidado do responsável — a parte que sobreviveu ao Conta Azul.
 *
 * Substitui `contracts.ts`, que tinha ~2.000 linhas misturando a lógica do
 * contrato (nossa) com a sincronização para o Conta Azul (integração). Ao
 * desligar a integração, só isto continuou valendo — e simplificou muito: o
 * antigo status `pending_replacement` existia só para marcar contrato já
 * enviado ao provedor externo, coisa que não acontece mais.
 *
 * Por que importa: é daqui que sai o valor do contrato quando uma matrícula é
 * cancelada, e é desse valor que a cobrança recorrente depende. Se o total não
 * baixar, a família continua sendo cobrada por aula que não tem mais.
 */

export type CancelContractItemResult =
  | {
      status: "updated";
      enrollmentId: string;
      guardianContractId: string;
      totalAmount: number;
    }
  | { status: "skipped"; enrollmentId: string; reason: string }
  | { status: "failed"; enrollmentId: string; stage: string; message: string };

/**
 * Recalcula o total do contrato somando os itens ativos.
 *
 * Sempre do zero, nunca incremental: somar e subtrair a cada evento acumula
 * erro e é impossível de auditar depois.
 */
async function recalcularTotal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guardianContractId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("guardian_financial_contract_items")
    .select("amount")
    .eq("guardian_contract_id", guardianContractId)
    .eq("status", "active");

  if (error) throw new Error(`soma dos itens: ${error.message}`);

  const total = (data ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Tira a matrícula cancelada do contrato do responsável e atualiza o total.
 *
 * Idempotente: item já cancelado devolve `skipped`, para o cancelamento poder
 * ser reprocessado sem descontar duas vezes.
 */
export async function cancelEnrollmentGuardianFinancialContractItem(input: {
  enrollmentId: string;
  cancelledAt: string;
}): Promise<CancelContractItemResult> {
  const { enrollmentId, cancelledAt } = input;

  try {
    const supabase = await createClient();

    const { data: item, error: itemError } = await supabase
      .from("guardian_financial_contract_items")
      .select("id, guardian_contract_id, status")
      .eq("enrollment_id", enrollmentId)
      .maybeSingle();

    if (itemError) {
      return {
        status: "failed",
        enrollmentId,
        stage: "load_item",
        message: itemError.message,
      };
    }

    if (!item) {
      return {
        status: "skipped",
        enrollmentId,
        reason: "matrícula sem item de contrato",
      };
    }

    if ((item.status as string) === "cancelled") {
      return {
        status: "skipped",
        enrollmentId,
        reason: "item já estava cancelado",
      };
    }

    const guardianContractId = item.guardian_contract_id as string;

    const { error: updateError } = await supabase
      .from("guardian_financial_contract_items")
      .update({
        status: "cancelled",
        ended_at: cancelledAt.slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id as string);

    if (updateError) {
      return {
        status: "failed",
        enrollmentId,
        stage: "cancel_item",
        message: updateError.message,
      };
    }

    const totalAmount = await recalcularTotal(supabase, guardianContractId);

    const { error: contractError } = await supabase
      .from("guardian_financial_contracts")
      .update({
        total_amount: totalAmount,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", guardianContractId);

    if (contractError) {
      return {
        status: "failed",
        enrollmentId,
        stage: "update_contract_total",
        message: contractError.message,
      };
    }

    return { status: "updated", enrollmentId, guardianContractId, totalAmount };
  } catch (e) {
    return {
      status: "failed",
      enrollmentId,
      stage: "unexpected",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Devolve ao contrato a matrícula que estava trancada.
 *
 * O caminho de volta do trancamento. Existe porque tirar do contrato é fácil e
 * botar de volta não era: sem isto, destrancar devolveria o aluno à turma e
 * deixaria o contrato valendo menos do que a família passa a dever — a escola
 * daria a aula de graça sem ninguém perceber, porque nenhuma tela compara o
 * total do contrato com as matrículas ativas.
 *
 * Idempotente pelo mesmo motivo do cancelamento: item já ativo devolve
 * `skipped` em vez de somar duas vezes.
 */
export async function reactivateEnrollmentGuardianFinancialContractItem(input: {
  enrollmentId: string;
}): Promise<CancelContractItemResult> {
  const { enrollmentId } = input;

  try {
    const supabase = await createClient();

    const { data: item, error: itemError } = await supabase
      .from("guardian_financial_contract_items")
      .select("id, guardian_contract_id, status")
      .eq("enrollment_id", enrollmentId)
      .maybeSingle();

    if (itemError) {
      return {
        status: "failed",
        enrollmentId,
        stage: "load_item",
        message: itemError.message,
      };
    }

    if (!item) {
      return {
        status: "skipped",
        enrollmentId,
        reason: "matrícula sem item de contrato",
      };
    }

    if ((item.status as string) === "active") {
      return {
        status: "skipped",
        enrollmentId,
        reason: "item já estava ativo",
      };
    }

    const guardianContractId = item.guardian_contract_id as string;

    const { error: updateError } = await supabase
      .from("guardian_financial_contract_items")
      .update({
        status: "active",
        // `ended_at` volta a ser nulo: item ativo com data de fim no passado
        // seria lido como encerrado por qualquer consulta que olhasse a data
        // em vez do status.
        ended_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id as string);

    if (updateError) {
      return {
        status: "failed",
        enrollmentId,
        stage: "reactivate_item",
        message: updateError.message,
      };
    }

    const totalAmount = await recalcularTotal(supabase, guardianContractId);

    const { error: contractError } = await supabase
      .from("guardian_financial_contracts")
      .update({
        total_amount: totalAmount,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", guardianContractId);

    if (contractError) {
      return {
        status: "failed",
        enrollmentId,
        stage: "update_contract_total",
        message: contractError.message,
      };
    }

    return { status: "updated", enrollmentId, guardianContractId, totalAmount };
  } catch (e) {
    return {
      status: "failed",
      enrollmentId,
      stage: "unexpected",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
