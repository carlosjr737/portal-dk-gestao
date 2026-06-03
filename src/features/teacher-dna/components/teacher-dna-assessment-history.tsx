"use client";

import { useState } from "react";
import { TeacherDnaLessonsModal } from "@/features/teacher-dna/components/teacher-dna-lessons-dialog";
import { DnaReportDownloadButton } from "@/features/teacher-dna/components/dna-report-download-button";
import {
  formatScore,
  getAssessmentOverallScore,
  getPerformanceLabel,
  roundScore,
} from "@/features/teacher-dna/scoring";
import type { TeacherDnaAssessment } from "@/features/teacher-dna/types";

export function TeacherDnaAssessmentHistory({
  teacherName,
  assessments,
}: {
  teacherName: string;
  assessments: TeacherDnaAssessment[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Histórico de avaliações
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clique em uma aula para ver a análise completa dos 12 pilares.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Pontuação geral</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Análise</th>
              <th className="px-4 py-3">Relatório</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assessments.map((assessment) => {
              const score = roundScore(getAssessmentOverallScore(assessment));

              return (
                <tr key={assessment.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    {formatDate(assessment.lesson_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {assessment.source}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {formatScore(score)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {getPerformanceLabel(score)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(assessment.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      Ver análise
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <DnaReportDownloadButton
                      reportPath={assessment.report_path}
                      label="Baixar PDF"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openId ? (
        <TeacherDnaLessonsModal
          teacherName={teacherName}
          assessments={assessments}
          initialAssessmentId={openId}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </section>
  );
}

function formatDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T12:00:00`));
}
