import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Faturamento contratado e cobertura de cobrança.
 *
 * DUAS CAMADAS, NÃO DOIS MODOS
 * Faturamento contratado é conta de casa: matrícula ativa × mensalidade menos
 * desconto. Sempre existiu, sempre foi exato, e não depende de integrar com
 * ninguém. Recebimento é outra coisa — depende de alguém avisar que o
 * dinheiro entrou, seja o webhook do Asaas, seja uma pessoa marcando.
 *
 * O sistema tratava as duas como uma só: `usa_pagamentos` desligava o módulo
 * inteiro, e escola sem Asaas ficava sem ver o próprio faturamento. Aqui elas
 * se separam.
 *
 * A COBERTURA É OBRIGATÓRIA
 * Recebimento nunca é comparado com o faturamento total. Se R$ 904 recebidos
 * forem lidos contra R$ 271 mil contratados, uma escola com 0,5% dos
 * contratos no Asaas parece estar levando 99,5% de calote. Contra o que está
 * de fato em cobrança, o número vira interpretável — e é por isso que a
 * cobertura sai junto e não é opcional.
 */

export type FaturamentoDoMes = {
  competencia: string;
  /** O combinado. Toda escola tem, com Asaas ou sem. */
  contratado: number;
  matriculasAtivas: number;
  /** Quantas matrículas têm cobrança acompanhada pelo sistema neste mês. */
  matriculasCobertas: number;
  /** Valor contratado só das cobertas — o denominador honesto do recebimento. */
  contratadoCoberto: number;
  /** Baixas manuais da competência. */
  recebidoManual: number;
  marcacoesManuais: number;
  /** Matrículas com assinatura viva no Asaas. */
  matriculasNoAsaas: number;
  /**
   * `true` enquanto o script `recebimento_01_modelo.sql` não tiver rodado.
   * A tela precisa saber a diferença entre "ninguém marcou nada" e "a tabela
   * ainda não existe" — as duas devolvem zero, e só uma é um problema.
   */
  modeloPendente: boolean;
};

/** Primeiro dia do mês, que é como a competência é gravada. */
export function competenciaDe(data = new Date()): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function getFaturamentoDoMes(
  competencia = competenciaDe(),
): Promise<FaturamentoDoMes> {
  const supabase = await createClient();

  const [matriculasRes, recebimentosRes, itensRes, assinaturasRes] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select("id, monthly_amount, discount_amount")
        .eq("status", "active"),
      supabase
        .from("recebimento_manual")
        .select("enrollment_id, valor")
        .eq("competencia", competencia),
      /*
       * A ligação matrícula → assinatura passa pelo item do contrato, porque
       * a assinatura é do RESPONSÁVEL — uma cobrança por família — e a
       * matrícula é do aluno. Irmãos dividem a mesma assinatura.
       *
       * As duas tabelas vêm separadas e se encontram no JavaScript: não há FK
       * entre `guardian_financial_contract_items` e `aluno_assinatura` (as
       * duas apontam para o contrato, não uma para a outra), então pedir o
       * embed ao PostgREST derrubaria a consulta inteira.
       */
      supabase
        .from("guardian_financial_contract_items")
        .select("enrollment_id, guardian_contract_id"),
      supabase
        .from("aluno_assinatura")
        .select("guardian_contract_id, origem, status"),
    ]);

  /*
   * A tabela nova pode não existir ainda. Só este erro é tolerado, e vira um
   * aviso na tela — os outros continuam estourando, porque falha silenciosa
   * em número financeiro é pior que tela quebrada.
   */
  const modeloPendente = Boolean(recebimentosRes.error || assinaturasRes.error);

  /* Mesma definição de receita líquida do resto do sistema: mensalidade menos
     desconto, nunca negativa. Desconto maior que a mensalidade é erro de
     digitação, e sem o piso ele abateria a receita das outras matrículas. */
  const liquido = (m: { monthly_amount: unknown; discount_amount: unknown }) =>
    Math.max(0, Number(m.monthly_amount ?? 0) - Number(m.discount_amount ?? 0));

  const valorPor = new Map<string, number>();
  let contratado = 0;
  for (const m of matriculasRes.data ?? []) {
    const v = liquido(m);
    contratado += v;
    valorPor.set(m.id as string, v);
  }

  /*
   * Origem `asaas` e assinatura não cancelada. `nenhuma` fica de fora do
   * recebimento de propósito: ela conta no faturamento e só nele, que é
   * exatamente o contrato sem cobrança acompanhada.
   */
  const contratosNoAsaas = new Set<string>();
  for (const a of assinaturasRes.data ?? []) {
    const contrato = a.guardian_contract_id as string | null;
    if (!contrato) continue;
    if ((a.origem as string | null) !== "asaas") continue;
    if ((a.status as string | null) === "cancelada") continue;
    contratosNoAsaas.add(contrato);
  }

  const cobertas = new Set<string>();
  const noAsaas = new Set<string>();
  for (const item of itensRes.data ?? []) {
    const enrollmentId = item.enrollment_id as string | null;
    const contrato = item.guardian_contract_id as string | null;
    if (!enrollmentId || !contrato) continue;
    if (!contratosNoAsaas.has(contrato)) continue;
    noAsaas.add(enrollmentId);
    cobertas.add(enrollmentId);
  }

  let recebidoManual = 0;
  for (const r of recebimentosRes.data ?? []) {
    recebidoManual += Number(r.valor ?? 0);
    const id = r.enrollment_id as string | null;
    if (id) cobertas.add(id);
  }

  let contratadoCoberto = 0;
  for (const id of cobertas) contratadoCoberto += valorPor.get(id) ?? 0;

  return {
    competencia,
    contratado,
    matriculasAtivas: matriculasRes.data?.length ?? 0,
    matriculasCobertas: cobertas.size,
    contratadoCoberto,
    recebidoManual,
    marcacoesManuais: recebimentosRes.data?.length ?? 0,
    matriculasNoAsaas: noAsaas.size,
    modeloPendente,
  };
}
