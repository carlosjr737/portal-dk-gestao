import { teacherDnaPillars } from "@/features/teacher-dna/constants";
import { TeacherAvatar } from "@/features/staff/teacher-avatar";
import { getHeatmapColor } from "@/features/teacher-dna/scoring";
import { getTeacherName } from "@/features/teacher-dna/queries";
import type { TeacherDnaTeacherScore } from "@/features/teacher-dna/types";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TeacherDnaPillarsHeatmap({
  scores,
}: {
  scores: TeacherDnaTeacherScore[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Matriz dos 13 pilares
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Heatmap de pontuação por professor e pilar.
        </p>
      </div>
      <Table
        containerClassName="rounded-none border-0"
        className="text-xs"
        minWidth="1120px"
      >
        {/* Os nomes curtos dos pilares já vêm capitalizados; o uppercase padrão
            do cabeçalho os deixaria em caixa alta. */}
        <TableHeader className="normal-case tracking-normal">
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-muted">
              Professor
            </TableHead>
            {teacherDnaPillars.map((pillar) => (
              <TableHead key={pillar.key} className="px-2 text-center">
                {pillar.shortName}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {scores.length > 0 ? (
            scores.map((score) => (
              // Sem hover: a primeira coluna é sticky com fundo próprio e não
              // acompanharia o realce do resto da linha.
              <TableRow key={score.teacher.id} className="hover:bg-transparent">
                <TableCell className="sticky left-0 z-10 bg-card font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <TeacherAvatar
                      name={getTeacherName(score.teacher)}
                      photoPath={score.teacher.photo_path}
                      size="sm"
                    />
                    <span>{getTeacherName(score.teacher)}</span>
                  </div>
                </TableCell>
                {teacherDnaPillars.map((pillar) => {
                  const value = score.pillarScores[pillar.key];

                  return (
                    <TableCell
                      key={pillar.key}
                      className="px-2 py-2 text-center"
                    >
                      <span
                        className={`inline-flex h-8 min-w-10 items-center justify-center rounded-md px-2 font-bold ${getHeatmapColor(value)}`}
                        title={pillar.name}
                      >
                        {value ?? "-"}
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={teacherDnaPillars.length + 1}>
              Nenhum professor avaliado no período.
            </TableEmpty>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
