import type { AudienceGrowthPoint } from "@/features/audience-metrics/queries";

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
