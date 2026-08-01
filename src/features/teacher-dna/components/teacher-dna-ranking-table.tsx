import Link from "next/link";
import { TeacherAvatar } from "@/features/staff/teacher-avatar";
import { TeacherDnaLessonsDialog } from "@/features/teacher-dna/components/teacher-dna-lessons-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        <h2 className="text-sm font-semibold text-foreground">
          Ranking dos professores
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ordenado pela pontuação geral no período filtrado.
        </p>
      </div>
      <Table containerClassName="rounded-none border-0" minWidth="980px">
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Professor</TableHead>
            <TableHead>Pontuação</TableHead>
            <TableHead>Aulas</TableHead>
            <TableHead>Melhor pilar</TableHead>
            <TableHead>Pilar de atenção</TableHead>
            <TableHead>Tendência</TableHead>
            <TableHead>Última avaliação</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scores.length > 0 ? (
            scores.map((score, index) => (
              <TableRow key={score.teacher.id}>
                <TableCell className="font-semibold text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <TeacherAvatar
                      name={getTeacherName(score.teacher)}
                      photoPath={score.teacher.photo_path}
                      size="sm"
                    />
                    <TeacherDnaLessonsDialog
                      teacherName={getTeacherName(score.teacher)}
                      assessments={score.assessments}
                    >
                      {getTeacherName(score.teacher)}
                    </TeacherDnaLessonsDialog>
                  </div>
                </TableCell>
                <TableCell>
                  <ScoreBadge score={score.overallScore} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {score.evaluatedLessons}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {score.bestPillar
                    ? `${score.bestPillar.name} (${score.bestPillar.score})`
                    : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {score.attentionPillar
                    ? `${score.attentionPillar.name} (${score.attentionPillar.score})`
                    : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTrend(score.trend)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(score.lastAssessmentDate)}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dna-professores/${score.teacher.id}?${getTeacherDnaQuery(filters)}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    Ver detalhe
                  </Link>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={9}>
              Nenhum professor avaliado no período.
            </TableEmpty>
          )}
        </TableBody>
      </Table>
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
