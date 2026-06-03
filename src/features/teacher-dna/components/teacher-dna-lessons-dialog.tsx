"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TeacherDnaLessonDetail } from "@/features/teacher-dna/components/teacher-dna-lesson-detail";
import {
  formatScore,
  getAssessmentOverallScore,
  getPerformanceLabel,
  getScoreTone,
  roundScore,
} from "@/features/teacher-dna/scoring";
import type { TeacherDnaAssessment } from "@/features/teacher-dna/types";

export function TeacherDnaLessonsModal({
  teacherName,
  assessments,
  initialAssessmentId = null,
  onClose,
}: {
  teacherName: string;
  assessments: TeacherDnaAssessment[];
  initialAssessmentId?: string | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialAssessmentId ?? (assessments.length === 1 ? assessments[0]?.id ?? null : null),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) {
    return null;
  }

  const selected = assessments.find((item) => item.id === selectedId) ?? null;
  const showBack = selected !== null && assessments.length > 1;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              DNA do Professor · análise por aula
            </p>
            <h2 className="truncate text-lg font-bold text-foreground">
              {teacherName}
            </h2>
            {selected ? (
              <p className="text-sm text-muted-foreground">
                Aula de {formatDate(selected.lesson_date)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {assessments.length}{" "}
                {assessments.length === 1 ? "aula avaliada" : "aulas avaliadas"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-2xl leading-none text-muted-foreground hover:bg-muted"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {showBack ? (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="mb-4 text-sm font-medium text-primary"
            >
              ← Voltar para a lista de aulas
            </button>
          ) : null}

          {selected ? (
            <TeacherDnaLessonDetail assessment={selected} />
          ) : assessments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma aula avaliada neste período.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {assessments.map((assessment) => (
                <li key={assessment.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(assessment.id)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        Aula de {formatDate(assessment.lesson_date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Origem: {assessment.source}
                      </p>
                    </div>
                    <ScoreBadge assessment={assessment} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TeacherDnaLessonsDialog({
  teacherName,
  assessments,
  children,
  triggerClassName,
}: {
  teacherName: string;
  assessments: TeacherDnaAssessment[];
  children: ReactNode;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasAssessments = assessments.length > 0;

  if (!hasAssessments) {
    return <span className={triggerClassName}>{children}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "text-left font-medium text-foreground hover:text-primary hover:underline"
        }
      >
        {children}
      </button>
      {open ? (
        <TeacherDnaLessonsModal
          teacherName={teacherName}
          assessments={assessments}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ScoreBadge({ assessment }: { assessment: TeacherDnaAssessment }) {
  const score = roundScore(getAssessmentOverallScore(assessment));
  const tone = getScoreTone(score);
  const classes = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    neutral: "bg-slate-50 text-slate-500 border-slate-200",
  }[tone];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border px-3 py-1 text-xs font-bold ${classes}`}
    >
      {formatScore(score)} · {getPerformanceLabel(score)}
    </span>
  );
}

function formatDate(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T12:00:00`));
}
