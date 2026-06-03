import {
  formatScore,
  getPerformanceLabel,
} from "@/features/teacher-dna/scoring";
import { getTeacherName } from "@/features/teacher-dna/queries";
import type { TeacherDnaDashboardData } from "@/features/teacher-dna/types";

export function TeacherDnaSummaryCards({
  data,
}: {
  data: TeacherDnaDashboardData;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <SummaryCard
        label="Média geral do time"
        value={formatScore(data.teamAverage)}
        detail={getPerformanceLabel(data.teamAverage)}
      />
      <SummaryCard
        label="Professor destaque"
        value={
          data.highlightedTeacher
            ? getTeacherName(data.highlightedTeacher.teacher)
            : "-"
        }
        detail={formatScore(data.highlightedTeacher?.overallScore ?? null)}
      />
      <SummaryCard
        label="Pilar mais forte"
        value={data.strongestPillar?.name ?? "-"}
        detail={formatScore(data.strongestPillar?.score ?? null)}
      />
      <SummaryCard
        label="Pilar mais crítico"
        value={data.criticalPillar?.name ?? "-"}
        detail={formatScore(data.criticalPillar?.score ?? null)}
      />
      <SummaryCard
        label="Professores avaliados"
        value={String(data.evaluatedTeachersCount)}
        detail={`${data.teachers.length} professores ativos`}
      />
      <SummaryCard
        label="Aulas analisadas"
        value={String(data.assessedLessonsCount)}
        detail="No período selecionado"
      />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 line-clamp-2 text-2xl font-bold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
