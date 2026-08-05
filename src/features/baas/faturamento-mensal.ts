import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ASAAS_ENV } from "@/features/baas/config";
import { criarCobrancaAvulsa } from "@/features/baas/asaas-conta";

/**
 * Faturamento mensal — as cobranças do mês nascem no dia 1.
 *
 * O modelo anterior criava uma ASSINATURA no provedor, que gerava a próxima
 * cobrança sozinha e com antecedência. Duas consequências ruins:
 *
 *   1. no dia 05/08 já existia a fatura de 05/09, que ninguém pediu;
 *   2. o valor dela ficava congelado no que o contrato valia em agosto —
 *      mudar a mensalidade não alcançava a cobrança já emitida.
 *
 * Aqui a fatura é montada a partir do contrato NO MOMENTO em que é gerada.
 * Reajuste, desconto novo, matrícula cancelada: tudo entra sozinho no mês
 * seguinte, porque a fonte é o contrato e não uma cópia dele feita meses atrás.
 *
 * CONTRATO COM ASSINATURA ATIVA NÃO ENTRA. As assinaturas criadas antes
 * continuam rodando no provedor, e cobrar por fora delas dobraria a conta da
 * família. A checagem é explícita e vem antes de qualquer emissão.
 */

export type ResultadoLote = {
  competencia: string;
  geradas: number;
  puladas: number;
  falhas: Array<{ contrato: string; motivo: string }>;
};

/** `AAAA-MM` do mês corrente. */
export function competenciaAtual(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Data de vencimento da competência, respeitando o dia combinado no contrato.
 *
 * Mês curto não pode empurrar a cobrança para o mês seguinte: contrato que
 * vence dia 31 vence dia 28 em fevereiro, não dia 3 de março.
 */
export function vencimentoDaCompetencia(
  competencia: string,
  diaDoContrato: number,
): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(Math.max(diaDoContrato, 1), ultimoDia);
  return `${competencia}-${String(dia).padStart(2, "0")}`;
}

/**
 * Gera as cobranças de uma competência para uma escola.
 *
 * Idempotente: `cobranca_mensal` tem unicidade em (contrato, competência), e
 * a violação dessa chave é tratada como "já foi", não como erro. Rodar duas
 * vezes no dia 1 não cobra ninguém duas vezes — e essa garantia mora no
 * banco, não na memória de quem chama.
 */
export async function gerarCobrancasDoMes(
  escolaId: string,
  competencia = competenciaAtual(),
): Promise<ResultadoLote> {
  const admin = createAdminClient();
  const resultado: ResultadoLote = {
    competencia,
    geradas: 0,
    puladas: 0,
    falhas: [],
  };

  const [{ data: escola }, { data: cred }] = await Promise.all([
    admin.from("school").select("usa_pagamentos").eq("id", escolaId).maybeSingle(),
    admin
      .from("school_payment_credentials")
      .select("api_key")
      .eq("escola_id", escolaId)
      .eq("environment", ASAAS_ENV)
      .maybeSingle(),
  ]);

  if (!escola?.usa_pagamentos) return resultado;

  const chave = (cred?.api_key as string | undefined) ?? null;
  if (!chave) {
    resultado.falhas.push({
      contrato: "-",
      motivo: `escola sem conta de pagamentos em ${ASAAS_ENV}`,
    });
    return resultado;
  }

  const { data: contratos } = await admin
    .from("guardian_financial_contracts")
    .select("id, guardian_id, total_amount, first_due_date, end_date")
    .eq("escola_id", escolaId)
    .gt("total_amount", 0);

  if (!contratos?.length) return resultado;

  const ids = contratos.map((c) => c.id as string);

  const [{ data: jaCobrados }, { data: assinaturas }] = await Promise.all([
    admin
      .from("cobranca_mensal")
      .select("guardian_contract_id")
      .eq("competencia", competencia)
      .in("guardian_contract_id", ids),
    // Contrato com assinatura viva no provedor continua sendo cobrado por ela.
    admin
      .from("aluno_assinatura")
      .select("guardian_contract_id, asaas_customer_id")
      .in("guardian_contract_id", ids)
      .neq("status", "cancelada"),
  ]);

  const cobrado = new Set(
    (jaCobrados ?? []).map((c) => c.guardian_contract_id as string),
  );
  const clientePorContrato = new Map<string, string>();
  const temAssinaturaViva = new Set<string>();
  for (const a of assinaturas ?? []) {
    const contrato = a.guardian_contract_id as string;
    const cliente = a.asaas_customer_id as string | null;
    if (cliente) clientePorContrato.set(contrato, cliente);
    temAssinaturaViva.add(contrato);
  }

  const fimDoMes = `${competencia}-31`;

  for (const contrato of contratos) {
    const id = contrato.id as string;

    if (cobrado.has(id) || temAssinaturaViva.has(id)) {
      resultado.puladas += 1;
      continue;
    }

    // Contrato encerrado antes desta competência não gera mais nada.
    const fim = contrato.end_date as string | null;
    if (fim && fim < `${competencia}-01`) {
      resultado.puladas += 1;
      continue;
    }

    const cliente = clientePorContrato.get(id);
    if (!cliente) {
      /*
       * Sem cliente no provedor não há como emitir, e criar um aqui, dentro
       * de um lote que roda sem ninguém olhando, duplicaria a pessoa lá
       * dentro na primeira divergência de cadastro. O contrato fica de fora e
       * o motivo vai no relatório.
       */
      resultado.falhas.push({
        contrato: id,
        motivo: "responsável ainda não tem cadastro no provedor",
      });
      continue;
    }

    const valor = Number(contrato.total_amount ?? 0);
    const primeiro = (contrato.first_due_date as string | null) ?? "";
    const dia = primeiro ? Number(primeiro.slice(8, 10)) : 5;
    const vencimento = vencimentoDaCompetencia(competencia, dia);

    // Contrato que começa depois desta competência ainda não fatura.
    if (primeiro && primeiro > fimDoMes) {
      resultado.puladas += 1;
      continue;
    }

    const r = await criarCobrancaAvulsa(chave, {
      customer: cliente,
      valor,
      vencimento,
      descricao: `Mensalidade ${competencia.split("-").reverse().join("/")}`,
      // Boleto entrega boleto E Pix na mesma fatura, sem cartão.
      forma: "BOLETO",
      externalReference: `mensal:${id}:${competencia}`,
    });

    if (!r.ok) {
      resultado.falhas.push({ contrato: id, motivo: r.error });
      await admin.from("cobranca_mensal").insert({
        escola_id: escolaId,
        guardian_contract_id: id,
        competencia,
        valor,
        vencimento,
        status: "falhou",
        erro: r.error,
      });
      continue;
    }

    const { error } = await admin.from("cobranca_mensal").insert({
      escola_id: escolaId,
      guardian_contract_id: id,
      competencia,
      asaas_payment_id: r.id,
      valor,
      vencimento,
      status: "gerada",
    });

    if (error) {
      /*
       * A cobrança EXISTE no provedor e não conseguimos registrar. Não pode
       * virar falha silenciosa: no próximo dia 1 o lote não veria o registro
       * e cobraria a família de novo.
       */
      console.error("[FATURAMENTO] cobrança criada mas não registrada", {
        contrato: id,
        competencia,
        paymentId: r.id,
        error: error.message,
      });
      resultado.falhas.push({
        contrato: id,
        motivo: `cobrança ${r.id} criada mas não registrada — conferir antes do próximo lote`,
      });
      continue;
    }

    resultado.geradas += 1;
  }

  return resultado;
}

/** Roda o lote para todas as escolas que cobram pelo sistema. */
export async function gerarCobrancasDeTodasAsEscolas(
  competencia = competenciaAtual(),
): Promise<ResultadoLote[]> {
  const admin = createAdminClient();
  const { data: escolas } = await admin
    .from("school")
    .select("id")
    .eq("usa_pagamentos", true);

  const resultados: ResultadoLote[] = [];
  for (const e of escolas ?? []) {
    resultados.push(await gerarCobrancasDoMes(e.id as string, competencia));
  }
  return resultados;
}
