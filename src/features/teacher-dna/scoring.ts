import {
  teacherDnaPillars,
  type TeacherDnaPillarKey,
} from "@/features/teacher-dna/constants";
import type {
  TeacherDnaAssessment,
  TeacherDnaTeacher,
  TeacherDnaTeacherScore,
} from "@/features/teacher-dna/types";

export function buildTeacherDnaScores({
  teachers,
  assessments,
}: {
  teachers: TeacherDnaTeacher[];
  assessments: TeacherDnaAssessment[];
}) {
  const assessmentsByTeacher = new Map<string, TeacherDnaAssessment[]>();

  for (const assessment of assessments) {
    assessmentsByTeacher.set(assessment.teacher_id, [
      ...(assessmentsByTeacher.get(assessment.teacher_id) ?? []),
      assessment,
    ]);
  }

  return teachers.map((teacher) =>
    buildTeacherScore(teacher, assessmentsByTeacher.get(teacher.id) ?? []),
  );
}

export function buildTeamPillarScores(scores: TeacherDnaTeacherScore[]) {
  return Object.fromEntries(
    teacherDnaPillars.map((pillar) => [
      pillar.key,
      roundScore(
        average(
          scores
            .map((score) => score.pillarScores[pillar.key])
            .filter((value): value is number => typeof value === "number"),
        ),
      ),
    ]),
  ) as Record<TeacherDnaPillarKey, number | null>;
}

export function getPerformanceLabel(score: number | null) {
  if (score === null) {
    return "Sem avaliação";
  }

  if (score >= 90) {
    return "Excelente";
  }

  if (score >= 80) {
    return "Muito bom";
  }

  if (score >= 70) {
    return "Em desenvolvimento";
  }

  if (score >= 60) {
    return "Atenção";
  }

  return "Crítico";
}

export function getScoreTone(score: number | null) {
  if (score === null) {
    return "neutral";
  }

  if (score >= 80) {
    return "success";
  }

  if (score >= 60) {
    return "warning";
  }

  return "danger";
}

export function getHeatmapColor(score: number | null) {
  if (score === null) {
    return "bg-slate-50 text-slate-400";
  }

  if (score >= 90) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (score >= 80) {
    return "bg-green-50 text-green-700";
  }

  if (score >= 70) {
    return "bg-yellow-50 text-yellow-800";
  }

  if (score >= 60) {
    return "bg-orange-50 text-orange-800";
  }

  return "bg-red-50 text-red-700";
}

export function formatScore(score: number | null) {
  return typeof score === "number" ? `${score}/100` : "-";
}

export function roundScore(value: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function buildTeacherScore(
  teacher: TeacherDnaTeacher,
  assessments: TeacherDnaAssessment[],
): TeacherDnaTeacherScore {
  const sortedAssessments = [...assessments].sort((a, b) =>
    getAssessmentDate(b).localeCompare(getAssessmentDate(a)),
  );
  const pillarScores = Object.fromEntries(
    teacherDnaPillars.map((pillar) => [
      pillar.key,
      roundScore(
        average(
          sortedAssessments
            .map((assessment) => getPillarScore(assessment, pillar.key))
            .filter((value): value is number => typeof value === "number"),
        ),
      ),
    ]),
  ) as Record<TeacherDnaPillarKey, number | null>;
  const overallScores = sortedAssessments
    .map((assessment) => getAssessmentOverallScore(assessment))
    .filter((value): value is number => typeof value === "number");
  const overallScore = roundScore(average(overallScores));
  const scoredPillars = teacherDnaPillars.reduce<
    Array<{ key: TeacherDnaPillarKey; name: string; score: number }>
  >((rows, pillar) => {
    const score = pillarScores[pillar.key];

    if (typeof score === "number") {
      rows.push({
        key: pillar.key,
        name: pillar.name,
        score,
      });
    }

    return rows;
  }, []);

  return {
    teacher,
    assessments: sortedAssessments,
    evaluatedLessons: sortedAssessments.length,
    overallScore,
    pillarScores,
    bestPillar:
      scoredPillars.length > 0
        ? [...scoredPillars].sort((a, b) => b.score - a.score)[0]
        : null,
    attentionPillar:
      scoredPillars.length > 0
        ? [...scoredPillars].sort((a, b) => a.score - b.score)[0]
        : null,
    trend: getTrend(sortedAssessments),
    lastAssessmentDate: sortedAssessments[0]?.lesson_date ?? null,
  };
}

function getTrend(assessments: TeacherDnaAssessment[]) {
  if (assessments.length < 2) {
    return assessments.length === 0 ? "none" : "stable";
  }

  const newest = getAssessmentOverallScore(assessments[0]);
  const previous = getAssessmentOverallScore(assessments[1]);

  if (newest === null || previous === null || Math.abs(newest - previous) < 3) {
    return "stable";
  }

  return newest > previous ? "up" : "down";
}

export function getAssessmentOverallScore(assessment: TeacherDnaAssessment) {
  if (Number.isFinite(assessment.overall_score) && assessment.overall_score > 0) {
    return Number(assessment.overall_score);
  }

  const pillarAverage = average(
    teacherDnaPillars
      .map((pillar) => getPillarScore(assessment, pillar.key))
      .filter((value): value is number => typeof value === "number"),
  );

  return pillarAverage;
}

function getPillarScore(
  assessment: TeacherDnaAssessment,
  key: TeacherDnaPillarKey,
) {
  const value = assessment.pillar_scores[key];
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function getAssessmentDate(assessment: TeacherDnaAssessment) {
  return assessment.lesson_date ?? assessment.created_at;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
