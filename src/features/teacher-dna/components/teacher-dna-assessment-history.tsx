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
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

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
          Clique em uma aula para ver a análise completa dos 13 pilares.
        </p>
      </div>
      <Table containerClassName="rounded-none border-0" minWidth="760px">
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Pontuação geral</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Análise</TableHead>
            <TableHead>Relatório</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assessments.length > 0 ? (
            assessments.map((assessment) => {
              const score = roundScore(getAssessmentOverallScore(assessment));

              return (
                <TableRow key={assessment.id}>
                  <TableCell>{formatDate(assessment.lesson_date)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {assessment.source}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatScore(score)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getPerformanceLabel(score)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setOpenId(assessment.id)}
                      className="text-xs font-semibold"
                    >
                      Ver análise
                    </Button>
                  </TableCell>
                  <TableCell>
                    <DnaReportDownloadButton
                      reportPath={assessment.report_path}
                      label="Baixar PDF"
                    />
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableEmpty colSpan={6}>Nenhuma avaliação registrada.</TableEmpty>
          )}
        </TableBody>
      </Table>

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
