import "server-only";

import { createClient } from "@/lib/supabase/server";
import { competenciaDe } from "@/features/faturamento/queries";

/**
 * Inadimplência: vencido e sem baixa.
 *
 * A REGRA É UMA SÓ, E NÃO DEPENDE DE PROVEDOR.
 * A matrícula tem data de vencimento. Chegou a data e ninguém disse que
 * pagou, é inadimplente. A origem muda QUEM diz:
 *
 *   asaas       o webhook diz sozinho
 *   sem_baixa   uma pessoa diz, na conciliação
 *
 * Uma versão anterior desta consulta tinha uma terceira categoria — matrícula
 * "não acompanhada", que ficava fora da conta — para evitar acusar 663
 * famílias de calote no dia seguinte ao vencimento. A leitura estava errada:
 * o silêncio não é ausência de informação, é a informação. O combinado com a
 * família é pagar no dia; não haver baixa depois do dia significa que não
 * consta pagamento, e é exatamente isso que a escola precisa ver para ir
 * atrás. Esconder atrás de "não acompanhada" transformava a lista num número
 * bonito e inútil.
 *
 * A ORIGEM CONTINUA IMPORTANDO, mas como rótulo e não como filtro:
 * `sem_baixa` pode ser gente que pagou e ninguém marcou, então a ação é
 * conferir antes de cobrar. Isso é diferente de não mostrar.
 *
 * O QUE DE FATO NÃO DÁ PARA JULGAR
 * Matrícula sem data de vencimento. Não é escolha de política — sem data não
 * existe "passou do prazo". Elas saem separadas, com esse nome, e são poucas.
 */

export type OrigemDivida = "asaas" | "sem_baixa";

export type Devedor = {
  enrollmentId: string;
  aluno: string;
  turma: string;
  responsavel: string;
  telefone: string | null;
  valor: number;
  vencimento: string;
  diasDeAtraso: number;
  origem: OrigemDivida;
};

export type InadimplenciaDoMes = {
  competencia: string;
  devedores: Devedor[];
  valorEmAtraso: number;

  matriculasAtivas: number;
  /** Já pagas: baixa manual ou confirmação do Asaas. */
  pagas: number;
  /** Ainda dentro do prazo neste mês. */
  aVencer: number;
  valorAVencer: number;

  /**
   * Sem data de vencimento — não dá para dizer se atrasou. Não é categoria de
   * política, é falta de dado.
   */
  semVencimento: number;
  valorSemVencimento: number;

  /** `true` enquanto `recebimento_01_modelo.sql` não tiver rodado. */
  modeloPendente: boolean;
};

/** Vencimento da competência, a partir do dia da primeira cobrança da matrícula. */
function vencimentoNaCompetencia(
  competencia: string,
  primeiroVencimento: string,
): string {
  const dia = Number(primeiroVencimento.slice(8, 10));
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const diaValido = Math.min(dia, ultimoDia);
  return `${competencia.slice(0, 7)}-${String(diaValido).padStart(2, "0")}`;
}

export async function getInadimplenciaDoMes(
  competencia = competenciaDe(),
): Promise<InadimplenciaDoMes> {
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
    supabase.from("guardians").select("id, full_name, phone"),
    supabase
      .from("recebimento_manual")
      .select("enrollment_id")
      .eq("competencia", competencia),
    supabase
      .from("guardian_financial_contract_items")
      .select("enrollment_id, guardian_contract_id"),
    supabase
      .from("aluno_assinatura")
      .select("guardian_contract_id, origem, status"),
  ]);

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
      { nome: g.full_name as string, telefone: (g.phone as string | null) ?? null },
    ]),
  );

  /*
   * A assinatura é do RESPONSÁVEL — uma cobrança por família — e a matrícula
   * é do aluno. As duas se encontram aqui e não no PostgREST: não há FK entre
   * item de contrato e assinatura, e pedir o embed derruba a consulta inteira.
   */
  const contratosNoAsaas = new Set<string>();
  const contratosPagosNoAsaas = new Set<string>();
  for (const a of assinaturasRes.data ?? []) {
    const contrato = a.guardian_contract_id as string | null;
    if (!contrato) continue;
    if ((a.origem as string | null) !== "asaas") continue;
    const st = (a.status as string | null) ?? "pendente";
    if (st === "cancelada") continue;
    contratosNoAsaas.add(contrato);
    // O webhook marca `paga` quando o dinheiro entra.
    if (st === "paga" || st === "recebida") contratosPagosNoAsaas.add(contrato);
  }

  const noAsaas = new Set<string>();
  const pagoNoAsaas = new Set<string>();
  for (const item of itensRes.data ?? []) {
    const enrollmentId = item.enrollment_id as string | null;
    const contrato = item.guardian_contract_id as string | null;
    if (!enrollmentId || !contrato) continue;
    if (contratosNoAsaas.has(contrato)) noAsaas.add(enrollmentId);
    if (contratosPagosNoAsaas.has(contrato)) pagoNoAsaas.add(enrollmentId);
  }

  const baixadas = new Set(
    (recebimentosRes.data ?? []).map((r) => r.enrollment_id as string),
  );

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const devedores: Devedor[] = [];
  let valorEmAtraso = 0;
  let pagas = 0;
  let aVencer = 0;
  let valorAVencer = 0;
  let semVencimento = 0;
  let valorSemVencimento = 0;

  for (const m of matriculasRes.data ?? []) {
    const enrollmentId = m.id as string;
    const valor = Math.max(
      0,
      Number(m.monthly_amount ?? 0) - Number(m.discount_amount ?? 0),
    );

    const primeiro = (m.first_due_date as string | null) ?? null;
    if (!primeiro) {
      semVencimento += 1;
      valorSemVencimento += valor;
      continue;
    }

    // Pagou: alguém disse que sim, seja o webhook ou uma pessoa.
    if (baixadas.has(enrollmentId) || pagoNoAsaas.has(enrollmentId)) {
      pagas += 1;
      continue;
    }

    const vencimento = vencimentoNaCompetencia(competencia, primeiro);
    const dataVenc = new Date(`${vencimento}T00:00:00`);
    if (dataVenc >= hoje) {
      aVencer += 1;
      valorAVencer += valor;
      continue;
    }

    const guardian = responsaveis.get(
      (m.financial_guardian_id as string | null) ?? "",
    );

    devedores.push({
      enrollmentId,
      aluno: alunos.get(m.student_id as string) ?? "Aluno",
      turma: turmas.get(m.class_id as string) ?? "—",
      responsavel: guardian?.nome ?? "Sem responsável financeiro",
      telefone: guardian?.telefone ?? null,
      valor,
      vencimento,
      diasDeAtraso: Math.floor(
        (hoje.getTime() - dataVenc.getTime()) / 86_400_000,
      ),
      origem: noAsaas.has(enrollmentId) ? "asaas" : "sem_baixa",
    });
    valorEmAtraso += valor;
  }

  devedores.sort((a, b) => b.diasDeAtraso - a.diasDeAtraso);

  return {
    competencia,
    devedores,
    valorEmAtraso,
    matriculasAtivas: matriculasRes.data?.length ?? 0,
    pagas,
    aVencer,
    valorAVencer,
    semVencimento,
    valorSemVencimento,
    modeloPendente,
  };
}
