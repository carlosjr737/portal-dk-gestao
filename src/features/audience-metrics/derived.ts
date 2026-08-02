import type {
  AudienceGrowthPoint,
  AudienceMetrics,
  AudienceSlice,
} from "@/features/audience-metrics/queries";

/**
 * Derivados dos indicadores de público.
 *
 * Módulo puro: nada aqui toca no Supabase. Tudo sai do que
 * `getAudienceMetrics()` já devolve.
 */

/**
 * Um mês de cadastro é carga inicial, não captação, quando sozinho responde
 * por boa parte da base inteira.
 *
 * O caso real: a importação de 20/05/2026 inseriu ~700 matrículas de uma vez,
 * e `students.created_at` cai no default do banco — o dia do import. Esse mês
 * concentra quase todos os cadastros e por isso achatava a série orgânica a
 * menos de um pixel.
 *
 * O limiar é heurística deliberada em vez de data fixa no código: qualquer
 * importação futura cai na mesma regra sem precisar de manutenção.
 */
const BULK_LOAD_SHARE = 0.5;

export function findBulkLoadPoint(
  points: AudienceGrowthPoint[],
  totalActiveStudents: number,
): AudienceGrowthPoint | null {
  if (totalActiveStudents <= 0) {
    return null;
  }

  return (
    points.find(
      (point) => point.count >= totalActiveStudents * BULK_LOAD_SHARE,
    ) ?? null
  );
}

export type RecentSignups = {
  /** Cadastros nos últimos `months` meses, fora qualquer carga em lote. */
  count: number;
  months: number;
  /** Rótulo do mês mais recente com algum cadastro. */
  lastLabel: string | null;
};

export function recentSignups(
  points: AudienceGrowthPoint[],
  bulkLoad: AudienceGrowthPoint | null,
  months = 3,
): RecentSignups {
  const organic = points.filter((point) => point.month !== bulkLoad?.month);
  const window = organic.slice(-months);
  const count = window.reduce((sum, point) => sum + point.count, 0);
  const last = [...organic].reverse().find((point) => point.count > 0) ?? null;

  return { count, months, lastLabel: last?.label ?? null };
}

/** Alunos por família. `null` quando não há família com matrícula ativa. */
export function studentsPerFamily(metrics: AudienceMetrics) {
  if (metrics.totalFamilies <= 0) {
    return null;
  }

  return metrics.totalActiveStudents / metrics.totalFamilies;
}

/**
 * Famílias com um filho só — a maior alavanca comercial da escola.
 *
 * Irmão de aluno matriculado é o lead mais barato que existe: já conhece a
 * escola, já tem responsável cadastrado, já vem no mesmo horário.
 *
 * Deliberadamente sem projeção de receita. A taxa de conversão de irmão é
 * desconhecida, e número inventado num painel contamina os que são reais. O
 * cartão mostra o fato; a conta é de quem for agir.
 */
export function singleChildFamilies(metrics: AudienceMetrics) {
  return metrics.familySizes.find((slice) => slice.label === "1 filho") ?? null;
}

export type ModalityConcentration = {
  top: AudienceSlice;
  rest: AudienceSlice[];
  /** Fração sobre alunos ativos, não sobre a soma das fatias. */
  share: number;
};

/**
 * Concentração por modalidade.
 *
 * O denominador é o total de alunos ativos, e não a soma das fatias: um aluno
 * pode estar em mais de uma modalidade, então as fatias somam mais de 100% e
 * dividir por elas produziria um percentual que promete um todo inexistente.
 */
export function modalityConcentration(
  metrics: AudienceMetrics,
): ModalityConcentration | null {
  const [top, ...rest] = metrics.byModality;

  if (!top || metrics.totalActiveStudents <= 0) {
    return null;
  }

  return { top, rest, share: top.count / metrics.totalActiveStudents };
}
