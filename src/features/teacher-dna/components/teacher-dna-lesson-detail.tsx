"use client";

import {
  teacherDnaPillars,
  type TeacherDnaPillarKey,
} from "@/features/teacher-dna/constants";
import { TeacherDnaPillarBars } from "@/features/teacher-dna/components/teacher-dna-pillar-bars";
import { DnaReportDownloadButton } from "@/features/teacher-dna/components/dna-report-download-button";
import {
  formatScore,
  getAssessmentOverallScore,
  getPerformanceLabel,
  roundScore,
} from "@/features/teacher-dna/scoring";
import type { TeacherDnaAssessment } from "@/features/teacher-dna/types";

export function TeacherDnaLessonDetail({
  assessment,
}: {
  assessment: TeacherDnaAssessment;
}) {
  const overall = roundScore(getAssessmentOverallScore(assessment));
  const pillarScores = buildPillarRecord(assessment);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Pontuação geral da aula
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {formatScore(overall)}
          </p>
          <p className="text-sm text-muted-foreground">
            {getPerformanceLabel(overall)}
          </p>
        </div>
        <DnaReportDownloadButton reportPath={assessment.report_path} />
      </div>

      <TeacherDnaPillarBars
        scores={pillarScores}
        title="Notas por pilar nesta aula"
      />

      {assessment.strengths?.length ? (
        <TextBlock title="Pontos fortes" items={assessment.strengths} />
      ) : null}

      {assessment.improvements?.length ? (
        <TextBlock title="Pontos de atenção" items={assessment.improvements} />
      ) : null}

      {assessment.summary ? (
        <section className="rounded-lg border border-border bg-white p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Resumo da análise
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {assessment.summary}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function TextBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-border bg-white p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function buildPillarRecord(assessment: TeacherDnaAssessment) {
  return Object.fromEntries(
    teacherDnaPillars.map((pillar) => {
      const value = Number(assessment.pillar_scores[pillar.key]);

      return [
        pillar.key,
        Number.isFinite(value) ? Math.round(value) : null,
      ];
    }),
  ) as Record<TeacherDnaPillarKey, number | null>;
}
