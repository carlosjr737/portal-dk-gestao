import { teacherDnaPillars } from "@/features/teacher-dna/constants";
import { TeacherAvatar } from "@/features/staff/teacher-avatar";
import { getHeatmapColor } from "@/features/teacher-dna/scoring";
import { getTeacherName } from "@/features/teacher-dna/queries";
import type { TeacherDnaTeacherScore } from "@/features/teacher-dna/types";

export function TeacherDnaPillarsHeatmap({
  scores,
}: {
  scores: TeacherDnaTeacherScore[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Matriz dos 12 pilares
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Heatmap de pontuação por professor e pilar.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full text-left text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/60 px-4 py-3">
                Professor
              </th>
              {teacherDnaPillars.map((pillar) => (
                <th key={pillar.key} className="px-2 py-3 text-center">
                  {pillar.shortName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {scores.map((score) => (
              <tr key={score.teacher.id}>
                <td className="sticky left-0 z-10 bg-white px-4 py-3 font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <TeacherAvatar
                      name={getTeacherName(score.teacher)}
                      photoPath={score.teacher.photo_path}
                      size="sm"
                    />
                    <span>{getTeacherName(score.teacher)}</span>
                  </div>
                </td>
                {teacherDnaPillars.map((pillar) => {
                  const value = score.pillarScores[pillar.key];

                  return (
                    <td key={pillar.key} className="px-2 py-2 text-center">
                      <span
                        className={`inline-flex h-8 min-w-10 items-center justify-center rounded-md px-2 font-bold ${getHeatmapColor(value)}`}
                        title={pillar.name}
                      >
                        {value ?? "-"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
