import {
  teacherDnaPillars,
  type TeacherDnaPillarKey,
} from "@/features/teacher-dna/constants";

export function TeacherDnaPillarBars({
  scores,
  title = "Média dos 12 pilares",
}: {
  scores: Record<TeacherDnaPillarKey, number | null>;
  title?: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-4 space-y-3">
        {teacherDnaPillars.map((pillar) => {
          const score = scores[pillar.key];

          return (
            <div key={pillar.key}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-foreground">{pillar.name}</span>
                <span className="font-semibold text-muted-foreground">
                  {score ?? "-"}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(0, score ?? 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
