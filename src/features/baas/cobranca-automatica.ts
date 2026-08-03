import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  atualizarAssinaturaAsaas,
  cancelarAssinaturaAsaas,
  criarAssinaturaAsaas,
  criarClienteAsaas,
} from "@/features/baas/asaas-client";
import { conferirAmbienteDaCredencial } from "@/features/baas/config";

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

    // Mesma trava do caminho manual. Aqui ela importa ainda mais: este fluxo
    // roda sozinho ao salvar matrícula, e sem a checagem cada salvamento
    // dispararia uma chamada que o Asaas já vai recusar.
    const ambiente = conferirAmbienteDaCredencial(
      cred?.environment as string | undefined,
    );
    if (!ambiente.ok) {
      return { status: "falhou", detalhe: ambiente.message };
    }

    const apiKey = (cred?.api_key as string | undefined) ?? null;
    if (!apiKey) {
      return { status: "falhou", detalhe: "escola sem conta de pagamentos" };
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

    // --- não existe: cria ------------------------------------------------
    const { data: guardian } = await admin
      .from("guardians")
      .select("id, full_name, document, email, phone")
      .eq("id", contrato.guardian_id as string)
      .maybeSingle();

    if (!guardian) return { status: "falhou", detalhe: "responsável não encontrado" };
    if (!String(guardian.document ?? "").trim()) {
      return {
        status: "falhou",
        detalhe: `${guardian.full_name} está sem CPF/CNPJ`,
      };
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

    // Vencimento do contrato se ainda for futuro; senão, mês que vem —
    // cobrança não nasce vencida.
    const hoje = new Date().toISOString().slice(0, 10);
    let primeiroVencimento = (contrato.first_due_date as string | null) ?? "";
    if (!primeiroVencimento || primeiroVencimento <= hoje) {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      primeiroVencimento = d.toISOString().slice(0, 10);
    }

    const nova = await criarAssinaturaAsaas(
      {
        customer: cliente.id,
        value: valor,
        nextDueDate: primeiroVencimento,
        cycle: "MONTHLY",
        // Responsável escolhe como pagar (Pix, boleto ou cartão).
        billingType: "UNDEFINED",
        description: "Mensalidade",
        externalReference: guardianContractId,
        endDate,
      },
      apiKey,
    );
    if (!nova.ok) return { status: "falhou", detalhe: nova.error };

    const { error } = await admin.from("aluno_assinatura").insert({
      escola_id: escolaId,
      guardian_contract_id: guardianContractId,
      guardian_id: guardian.id,
      asaas_customer_id: cliente.id,
      asaas_subscription_id: nova.id,
      status: "pendente",
      valor,
      proximo_vencimento: primeiroVencimento,
      forma_pagamento: "UNDEFINED",
    });

    if (error) {
      // Existe no provedor mas não aqui: registra com o id para não sumir.
      console.error("[COBRANCA AUTO] criada no provedor mas não registrada", {
        guardianContractId,
        subscriptionId: nova.id,
        error: error.message,
      });
      return { status: "falhou", detalhe: `criada (${nova.id}) mas não registrada` };
    }

    return {
      status: "criada",
      detalhe: `R$ ${valor} até ${endDate ?? "sem prazo"}`,
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
