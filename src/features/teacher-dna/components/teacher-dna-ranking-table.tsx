import Link from "next/link";
import {
  formatScore,
  getPerformanceLabel,
  getScoreTone,
} from "@/features/teacher-dna/scoring";
import { getTeacherDnaQuery, getTeacherName } from "@/features/teacher-dna/queries";
import type {
  TeacherDnaFilters,
  TeacherDnaTeacherScore,
} from "@/features/teacher-dna/types";

export function TeacherDnaRankingTable({
  scores,
  filters,
}: {
  scores: TeacherDnaTeacherScore[];
  filters: TeacherDnaFilters;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Ranking dos professores
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ordenado pela pontuação geral no período filtrado.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Professor</th>
              <th className="px-4 py-3">Pontuação</th>
              <th className="px-4 py-3">Aulas</th>
              <th className="px-4 py-3">Melhor pilar</th>
              <th className="px-4 py-3">Pilar de atenção</th>
              <th className="px-4 py-3">Tendência</th>
              <th className="px-4 py-3">Última avaliação</th>
              <th className="px-4 py-3">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {scores.map((score, index) => (
              <tr key={score.teacher.id}>
                <td className="px-4 py-3 font-semibold text-muted-foreground">
                  {index + 1}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {getTeacherName(score.teacher)}
                </td>
                <td className="px-4 py-3">
                  <ScoreBadge score={score.overallScore} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {score.evaluatedLessons}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {score.bestPillar
                    ? `${score.bestPillar.name} (${score.bestPillar.score})`
                    : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {score.attentionPillar
                    ? `${score.attentionPillar.name} (${score.attentionPillar.score})`
                    : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatTrend(score.trend)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(score.lastAssessmentDate)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dna-professores/${score.teacher.id}?${getTeacherDnaQuery(filters)}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    Ver detalhe
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  const tone = getScoreTone(score);
  const classes = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    neutral: "bg-slate-50 text-slate-500 border-slate-200",
  }[tone];

  return (
    <span
      className={`inline-flex min-w-[116px] items-center justify-center rounded-full border px-3 py-1 text-xs font-bold ${classes}`}
    >
      {formatScore(score)} · {getPerformanceLabel(score)}
    </span>
  );
}

function formatTrend(trend: TeacherDnaTeacherScore["trend"]) {
  const labels = {
    up: "Subindo",
    down: "Caindo",
    stable: "Estável",
    none: "-",
  };

  return labels[trend];
}

function formatDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T12:00:00`));
}
