import type { MonthlyBasePoint } from "@/features/school-metrics/monthly-base";
import type { SchoolMetrics } from "@/features/school-metrics/queries";

/**
 * Derivados dos KPIs da escola.
 *
 * Módulo puro de propósito: nada aqui toca no Supabase. Todo número sai de
 * campos que `getSchoolMetrics()` já devolve, então o redesenho das telas de
 * métricas não muda nenhum cálculo — `queries.ts` fica intacto.
 */

/** Matrículas por aluno. `null` quando não há aluno ativo. */
export function enrollmentsPerStudent(metrics: SchoolMetrics) {
  if (metrics.activeStudents <= 0) {
    return null;
  }

  return metrics.activeEnrollments / metrics.activeStudents;
}

/** Alunos por turma. `null` quando não há turma ativa. */
export function studentsPerClass(metrics: SchoolMetrics) {
  if (metrics.activeClasses <= 0) {
    return null;
  }

  return metrics.activeStudents / metrics.activeClasses;
}

/**
 * Fração da receita bruta que virou desconto. `null` quando não há bruta —
 * imprimir "0%" nesse caso seria inventar um dado que não existe.
 */
export function discountShare(metrics: SchoolMetrics) {
  if (metrics.grossRevenue <= 0) {
    return null;
  }

  return metrics.totalDiscount / metrics.grossRevenue;
}

export type IdleCapacity = {
  seats: number;
  /** Teto teórico em R$. `null` sem ticket médio para projetar. */
  amount: number | null;
};

/**
 * Vagas ociosas e o quanto elas valeriam ao ticket médio atual.
 *
 * É um **teto teórico**, e a interface precisa dizer isso: nem toda vaga é
 * vendável — horário, sala e professor limitam. Chamar de "receita perdida"
 * prometeria um número que não existe.
 *
 * Usa o mesmo par (`totalCapacity`, `activeEnrollments`) que `occupancyRate`
 * já usa em queries.ts, então herda a inconsistência existente — capacidade
 * conta só turmas ativas — em vez de criar uma nova.
 *
 * O ticket é por matrícula, não por aluno: a vaga se preenche com uma
 * matrícula, e `averageTicketPerStudent` (maior) inflaria a projeção.
 */
export function idleCapacity(metrics: SchoolMetrics): IdleCapacity | null {
  if (metrics.totalCapacity <= 0) {
    return null;
  }

  const seats = Math.max(0, metrics.totalCapacity - metrics.activeEnrollments);
  const ticket = metrics.averageTicketPerEnrollment;

  return { seats, amount: ticket === null ? null : seats * ticket };
}

/**
 * Variação de alunos entre os dois últimos meses da base.
 *
 * **Absoluta, nunca percentual.** `metrics.activeStudents` vem de
 * `students.status = 'active'`; a série de `getMonthlyActiveBase()` vem de
 * datas de matrícula e mede o mês corrente num dia que ainda não chegou. Um
 * percentual misturando as duas fontes seria falso com cara de preciso.
 */
export function studentsDelta(points: MonthlyBasePoint[] | undefined) {
  if (!points || points.length < 2) {
    return null;
  }

  const current = points[points.length - 1];
  const previous = points[points.length - 2];

  return current.students - previous.students;
}
