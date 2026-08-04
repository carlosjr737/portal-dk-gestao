import "server-only";

import { createClient } from "@/lib/supabase/server";
import { competenciaDe } from "@/features/faturamento/queries";

/**
 * Conciliação de recebimentos.
 *
 * A COBRANÇA ESPERADA NÃO É MATERIALIZADA. A lista sai de matrículas ativas ×
 * competência, montada aqui. Só o recebimento vira linha em `recebimento_manual`
 * — materializar as 666 cobranças todo mês criaria um cemitério de registros
 * que ninguém preenche.
 *
 * RECEBIMENTO TEM DENOMINADOR PRÓPRIO. O que entrou nunca é comparado com o
 * faturamento total: é comparado com o que está sendo cobrado pelo sistema.
 * Sem isso, uma escola com 1 contrato no Asaas parece estar levando 99% de
 * calote. Por isso `contratadoCoberto` sai junto e a tela é obrigada a mostrar
 * a linha de cobertura.
 */

export type OrigemCobranca = "asaas" | "manual" | "nenhuma";

export type LinhaRecebimento = {
  enrollmentId: string;
  alunoNome: string;
  responsavelNome: string | null;
  turmaNome: string | null;
  valor: number;
  /** Dia do vencimento dentro da competência. `null` quando não cadastrado. */
  vencimento: string | null;
  origem: OrigemCobranca;
  paga: boolean;
  /** Preenchido quando paga: data e valor efetivos. */
  recebidoEm: string | null;
  valorRecebido: number | null;
  /** Detalhe da baixa automática, para a linha travada. */
  detalheAsaas: string | null;
  /**
   * Linha do Asaas é somente leitura, sem exceção — quem manda ali é o
   * webhook. Marcar à mão criaria duas verdades para o mesmo dinheiro.
   */
  travada: boolean;
};

/**
 * Em qual dos três estados a escola está. Não são telas diferentes: o que muda
 * é se a linha é acionável e o que a segunda coluna do resumo mede.
 */
export type ContextoCobranca = "sem_cobranca" | "misto" | "total";

export type RecebimentosDoMes = {
  competencia: string;
  contexto: ContextoCobranca;
  /** O combinado. Toda escola tem, com Asaas ou sem. */
  contratado: number;
  matriculasAtivas: number;
  /** Matrículas com cobrança acompanhada pelo sistema. */
  matriculasCobertas: number;
  /** Valor das cobertas — o denominador honesto do recebimento. */
  contratadoCoberto: number;
  recebido: number;
  cobrancasRecebidas: number;
  emAtraso: number;
  valorEmAtraso: number;
  marcacoesManuais: number;
  matriculasNoAsaas: number;
  /** Dias de vencimento com alguma linha em aberto, para a ação em lote. */
  diasComPendencia: number[];
  /**
   * Quantas matrículas não têm vencimento cadastrado. Hoje é quase toda a
   * base, e sem isso a tela fingiria que a coluna de data está completa.
   */
  semVencimento: number;
  linhas: LinhaRecebimento[];
  /** `true` enquanto `recebimento_01_modelo.sql` não tiver rodado no banco. */
  modeloPendente: boolean;
};

/** Último dia da competência, para decidir o que está em atraso. */
function fimDaCompetencia(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(ano, mes, 0);
}

/**
 * O vencimento do mês a partir do dia cadastrado na matrícula.
 *
 * Fevereiro não tem dia 31: o dia é limitado ao último do mês em vez de
 * transbordar para março, que é o que `new Date(ano, mes, 31)` faria.
 */
function vencimentoNaCompetencia(
  competencia: string,
  primeiroVencimento: string | null,
) {
  if (!primeiroVencimento) return null;

  const dia = Number(primeiroVencimento.slice(8, 10));
  if (!Number.isFinite(dia) || dia < 1) return null;

  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const diaValido = Math.min(dia, ultimoDia);

  return `${competencia.slice(0, 7)}-${String(diaValido).padStart(2, "0")}`;
}

export async function getRecebimentosDoMes(
  competencia = competenciaDe(),
): Promise<RecebimentosDoMes> {
  const supabase = await createClient();

  const [
    matriculasRes,
    alunosRes,
    turmasRes,
    responsaveisRes,
    recebimentosRes,
    itensRes,
    assinaturasRes,
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "id, student_id, class_id, financial_guardian_id, monthly_amount, discount_amount, first_due_date",
      )
      .eq("status", "active"),
    supabase.from("students").select("id, full_name"),
    supabase.from("classes").select("id, name"),
    supabase.from("guardians").select("id, full_name"),
    supabase
      .from("recebimento_manual")
      .select("enrollment_id, valor, recebido_em")
      .eq("competencia", competencia),
    supabase
      .from("guardian_financial_contract_items")
      .select("enrollment_id, guardian_contract_id"),
    supabase
      .from("aluno_assinatura")
      .select("guardian_contract_id, origem, status, forma_pagamento"),
  ]);

  // Só a ausência da tabela nova é tolerada, e vira aviso na tela. Os outros
  // erros continuam estourando: falha silenciosa em número financeiro é pior
  // que tela quebrada.
  const modeloPendente = Boolean(recebimentosRes.error || assinaturasRes.error);

  const alunos = new Map(
    (alunosRes.data ?? []).map((a) => [a.id as string, a.full_name as string]),
  );
  const turmas = new Map(
    (turmasRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  );
  const responsaveis = new Map(
    (responsaveisRes.data ?? []).map((g) => [
      g.id as string,
      g.full_name as string,
    ]),
  );

  /*
   * A ligação matrícula → assinatura passa pelo item do contrato, porque a
   * assinatura é do RESPONSÁVEL — uma cobrança por família — e a matrícula é
   * do aluno. Irmãos dividem a mesma assinatura.
   */
  type Assinatura = { status: string; forma: string };
  const assinaturaPorContrato = new Map<string, Assinatura>();
  for (const a of assinaturasRes.data ?? []) {
    const contrato = a.guardian_contract_id as string | null;
    if (!contrato) continue;
    if ((a.origem as string | null) !== "asaas") continue;
    if ((a.status as string | null) === "cancelada") continue;
    assinaturaPorContrato.set(contrato, {
      status: (a.status as string | null) ?? "pendente",
      forma: (a.forma_pagamento as string | null) ?? "UNDEFINED",
    });
  }

  const assinaturaPorMatricula = new Map<string, Assinatura>();
  for (const item of itensRes.data ?? []) {
    const enrollmentId = item.enrollment_id as string | null;
    const contrato = item.guardian_contract_id as string | null;
    if (!enrollmentId || !contrato) continue;
    const assinatura = assinaturaPorContrato.get(contrato);
    if (assinatura) assinaturaPorMatricula.set(enrollmentId, assinatura);
  }

  const manualPorMatricula = new Map<
    string,
    { valor: number; recebidoEm: string }
  >();
  for (const r of recebimentosRes.data ?? []) {
    const id = r.enrollment_id as string | null;
    if (!id) continue;
    manualPorMatricula.set(id, {
      valor: Number(r.valor ?? 0),
      recebidoEm: String(r.recebido_em),
    });
  }

  const hoje = new Date();
  const fim = fimDaCompetencia(competencia);
  const linhas: LinhaRecebimento[] = [];

  let contratado = 0;
  let contratadoCoberto = 0;
  let recebido = 0;
  let cobrancasRecebidas = 0;
  let emAtraso = 0;
  let valorEmAtraso = 0;
  let semVencimento = 0;
  const diasComPendencia = new Set<number>();

  for (const m of matriculasRes.data ?? []) {
    const enrollmentId = m.id as string;

    /* Mesma definição de receita líquida do resto do sistema: mensalidade
       menos desconto, nunca negativa. */
    const valor = Math.max(
      0,
      Number(m.monthly_amount ?? 0) - Number(m.discount_amount ?? 0),
    );
    contratado += valor;

    const vencimento = vencimentoNaCompetencia(
      competencia,
      (m.first_due_date as string | null) ?? null,
    );
    if (!vencimento) semVencimento += 1;

    const asaas = assinaturaPorMatricula.get(enrollmentId);
    const manual = manualPorMatricula.get(enrollmentId);

    // `nenhuma` é o contrato sem cobrança acompanhada: conta no faturamento e
    // só nele. É o estado normal enquanto a escola migra para o Asaas.
    const origem: OrigemCobranca = asaas
      ? "asaas"
      : manual
        ? "manual"
        : "nenhuma";

    const paga = asaas ? asaas.status === "ativa" : Boolean(manual);
    const coberta = Boolean(asaas || manual);
    if (coberta) contratadoCoberto += valor;

    if (paga) {
      const valorPago = manual?.valor ?? valor;
      recebido += valorPago;
      cobrancasRecebidas += 1;
    }

    // Atraso só faz sentido com vencimento cadastrado e cobrança acompanhada.
    const venceu = vencimento
      ? new Date(`${vencimento}T23:59:59`) < hoje
      : fim < hoje;
    if (!paga && coberta && venceu) {
      emAtraso += 1;
      valorEmAtraso += valor;
    }

    if (!paga && vencimento) {
      diasComPendencia.add(Number(vencimento.slice(8, 10)));
    }

    linhas.push({
      enrollmentId,
      alunoNome: alunos.get(m.student_id as string) ?? "Aluno sem nome",
      responsavelNome:
        responsaveis.get(m.financial_guardian_id as string) ?? null,
      turmaNome: turmas.get(m.class_id as string) ?? null,
      valor,
      vencimento,
      origem,
      paga,
      recebidoEm: manual?.recebidoEm ?? null,
      valorRecebido: manual?.valor ?? null,
      detalheAsaas: asaas ? descreverAsaas(asaas.status, asaas.forma) : null,
      travada: Boolean(asaas),
    });
  }

  linhas.sort(
    (a, b) =>
      (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999") ||
      a.alunoNome.localeCompare(b.alunoNome, "pt-BR"),
  );

  const matriculasAtivas = linhas.length;
  const matriculasNoAsaas = assinaturaPorMatricula.size;
  const matriculasCobertas = linhas.filter(
    (l) => l.origem !== "nenhuma",
  ).length;

  return {
    competencia,
    contexto: definirContexto(matriculasAtivas, matriculasNoAsaas),
    contratado,
    matriculasAtivas,
    matriculasCobertas,
    contratadoCoberto,
    recebido,
    cobrancasRecebidas,
    emAtraso,
    valorEmAtraso,
    marcacoesManuais: manualPorMatricula.size,
    matriculasNoAsaas,
    diasComPendencia: [...diasComPendencia].sort((a, b) => a - b),
    semVencimento,
    linhas,
    modeloPendente,
  };
}

function definirContexto(
  matriculasAtivas: number,
  noAsaas: number,
): ContextoCobranca {
  if (noAsaas === 0) return "sem_cobranca";
  if (noAsaas >= matriculasAtivas) return "total";
  return "misto";
}

/*
 * `CREDIT_CARD` continua aqui mesmo tendo saído das formas que o portal pede.
 * Este mapa é de LEITURA: some o rótulo e uma cobrança antiga passa a ser
 * descrita como "pago", perdendo a informação de como foi paga.
 */
const FORMAS: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
};

function descreverAsaas(status: string, forma: string) {
  if (status === "ativa") return `Asaas · ${FORMAS[forma] ?? "pago"}`;
  if (status === "atrasada") return "Asaas · em atraso";
  return "Asaas · aguardando";
}
