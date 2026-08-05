import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  atualizarAssinaturaAsaas,
  cancelarAssinaturaAsaas,
  criarClienteAsaas,
} from "@/features/baas/asaas-client";
import { ASAAS_ENV } from "@/features/baas/config";
import { motivoDocumentoInvalido } from "@/lib/documento";

export type ResultadoCobranca = {
  status: "criada" | "atualizada" | "encerrada" | "ignorada" | "falhou";
  detalhe: string;
};

/**
 * Garante que a cobrança recorrente do responsável reflita o contrato dele.
 *
 * Chamada automaticamente ao concluir a matrícula: se a escola optou pela
 * integração financeira, a cobrança nasce junto — ninguém clica em nada.
 *
 * O contrato é CONSOLIDADO por responsável: um segundo filho, ou uma segunda
 * turma, somam ao mesmo contrato. Por isso esta função é idempotente e trata
 * três casos:
 *
 *   sem assinatura + valor > 0   -> cria
 *   com assinatura + valor mudou -> atualiza (inclusive a cobrança em aberto)
 *   com assinatura + valor zerou -> encerra (todas as matrículas cancelaram)
 *
 * Nunca lança: falha aqui não pode derrubar a matrícula, que é o ato
 * principal. Devolve o resultado para quem chamou registrar.
 */
export async function garantirCobrancaDoContrato(
  guardianContractId: string,
): Promise<ResultadoCobranca> {
  try {
    const admin = createAdminClient();

    const { data: contrato } = await admin
      .from("guardian_financial_contracts")
      .select("id, guardian_id, total_amount, first_due_date, end_date, escola_id")
      .eq("id", guardianContractId)
      .maybeSingle();

    if (!contrato) {
      return { status: "falhou", detalhe: "contrato não encontrado" };
    }

    const escolaId = contrato.escola_id as string;

    const [{ data: escola }, { data: cred }, { data: assinatura }] =
      await Promise.all([
        admin
          .from("school")
          .select("usa_pagamentos")
          .eq("id", escolaId)
          .maybeSingle(),
        admin
          .from("school_payment_credentials")
          .select("api_key, environment")
          .eq("escola_id", escolaId)
          .eq("environment", ASAAS_ENV)
          .maybeSingle(),
        admin
          .from("aluno_assinatura")
          .select("id, asaas_subscription_id, asaas_customer_id, valor, forma_pagamento")
          .eq("guardian_contract_id", guardianContractId)
          .maybeSingle(),
      ]);

    // Escola que só quer a gestão não gera cobrança nenhuma.
    if (!escola?.usa_pagamentos) {
      return { status: "ignorada", detalhe: "escola não usa o módulo de pagamento" };
    }

    // Credencial já filtrada pelo ambiente atual: a linha do outro ambiente
    // nem é carregada. Sem conta aqui, não há o que cobrar.
    const apiKey = (cred?.api_key as string | undefined) ?? null;
    if (!apiKey) {
      return {
        status: "falhou",
        detalhe: `escola sem conta de pagamentos em ${ASAAS_ENV}`,
      };
    }

    const valor = Number(contrato.total_amount ?? 0);

    // --- todas as matrículas do responsável cancelaram -------------------
    if (valor <= 0) {
      if (!assinatura) {
        return { status: "ignorada", detalhe: "contrato sem valor" };
      }
      const r = await cancelarAssinaturaAsaas(
        assinatura.asaas_subscription_id as string,
        apiKey,
      );
      if (!r.ok) return { status: "falhou", detalhe: r.error };

      await admin
        .from("aluno_assinatura")
        .update({
          status: "cancelada",
          cancelada_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", assinatura.id);

      return { status: "encerrada", detalhe: "contrato zerado" };
    }

    // Matrícula até dezembro => cobrança até dezembro.
    const endDate = (contrato.end_date as string | null) ?? undefined;

    // --- já existe: só acompanha o valor ---------------------------------
    if (assinatura) {
      if (Number(assinatura.valor) === valor) {
        return { status: "ignorada", detalhe: "valor inalterado" };
      }
      const r = await atualizarAssinaturaAsaas(
        assinatura.asaas_subscription_id as string,
        { value: valor, endDate },
        apiKey,
      );
      if (!r.ok) return { status: "falhou", detalhe: r.error };

      await admin
        .from("aluno_assinatura")
        .update({ valor, updated_at: new Date().toISOString() })
        .eq("id", assinatura.id);

      return {
        status: "atualizada",
        detalhe: `valor ${assinatura.valor} -> ${valor}`,
      };
    }

    /* --- não existe assinatura: NÃO cria mais ---------------------------
     *
     * A mensalidade deixou de ser assinatura no provedor. Assinatura gera a
     * próxima cobrança sozinha, com antecedência — no dia 05/08 já existia a
     * fatura de 05/09 — e com o valor congelado no que o contrato valia
     * quando ela foi criada. Reajuste não alcançava a cobrança já emitida.
     *
     * Agora quem emite é o lote do dia 1 (`faturamento-mensal.ts`), lendo o
     * contrato no momento da emissão. O que falta a este contrato é só o
     * CLIENTE no provedor — sem ele o lote não tem para quem emitir.
     */
    const { data: guardian } = await admin
      .from("guardians")
      .select("id, full_name, document, email, phone")
      .eq("id", contrato.guardian_id as string)
      .maybeSingle();

    if (!guardian)
      return { status: "falhou", detalhe: "responsável não encontrado" };

    // Mesma checagem do caminho manual: erra aqui, e o provedor só devolveria
    // "O CPF/CNPJ informado é inválido", sem dizer de quem.
    const motivo = motivoDocumentoInvalido(guardian.document);
    if (motivo) {
      return { status: "falhou", detalhe: `${guardian.full_name} ${motivo}` };
    }

    const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

    const cliente = await criarClienteAsaas(
      {
        name: guardian.full_name as string,
        cpfCnpj: soDigitos(guardian.document),
        email: (guardian.email as string | null) ?? undefined,
        mobilePhone: soDigitos(guardian.phone) || undefined,
        externalReference: guardian.id as string,
        // A escola entrega a cobrança; notificação do provedor é cobrada.
        notificationDisabled: true,
      },
      apiKey,
    );
    if (!cliente.ok) return { status: "falhou", detalhe: cliente.error };

    /*
     * A linha em `aluno_assinatura` nasce SEM `asaas_subscription_id`.
     *
     * Ela deixa de representar uma assinatura e passa a ser o vínculo entre o
     * contrato e o cliente no provedor — é por ela que o lote descobre para
     * quem emitir. E é a ausência do id que diz ao lote "este contrato é meu":
     * contrato COM assinatura viva continua sendo cobrado por ela, e o lote
     * passa longe.
     */
    const { error } = await admin.from("aluno_assinatura").insert({
      escola_id: escolaId,
      guardian_contract_id: guardianContractId,
      guardian_id: guardian.id,
      asaas_customer_id: cliente.id,
      asaas_subscription_id: null,
      status: "pendente",
      valor,
      proximo_vencimento: (contrato.first_due_date as string | null) ?? null,
      forma_pagamento: "BOLETO",
    });

    if (error) {
      console.error("[COBRANCA AUTO] cliente criado mas vínculo não registrado", {
        guardianContractId,
        customerId: cliente.id,
        error: error.message,
      });
      return {
        status: "falhou",
        detalhe: `cliente ${cliente.id} criado mas não registrado`,
      };
    }

    return {
      status: "criada",
      detalhe: "responsável pronto para o faturamento do dia 1",
    };
  } catch (e) {
    // Cobrança não pode derrubar a matrícula.
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[COBRANCA AUTO] erro inesperado", { guardianContractId, msg });
    return { status: "falhou", detalhe: msg };
  }
}

/** Descobre o contrato da matrícula e garante a cobrança dele. */
export async function garantirCobrancaDaMatricula(
  enrollmentId: string,
): Promise<ResultadoCobranca> {
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("guardian_financial_contract_items")
    .select("guardian_contract_id")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  const contratoId = (item?.guardian_contract_id as string | undefined) ?? null;
  if (!contratoId) {
    return { status: "falhou", detalhe: "matrícula sem contrato consolidado" };
  }
  return garantirCobrancaDoContrato(contratoId);
}
