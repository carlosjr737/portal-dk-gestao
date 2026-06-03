import { createClient } from "@/lib/supabase/server";
import { getStaffDisplayName } from "@/features/staff/formatters";
import {
  teacherDnaPeriodOptions,
  teacherDnaPillars,
  type TeacherDnaPeriod,
  type TeacherDnaPillarKey,
  type TeacherDnaStatusFilter,
} from "@/features/teacher-dna/constants";
import {
  buildTeacherDnaScores,
  buildTeamPillarScores,
  roundScore,
} from "@/features/teacher-dna/scoring";
import type {
  TeacherDnaAssessment,
  TeacherDnaCatalogOption,
  TeacherDnaClass,
  TeacherDnaDashboardData,
  TeacherDnaFilters,
  TeacherDnaTeacher,
} from "@/features/teacher-dna/types";

type SearchParams = {
  period?: string;
  teacherId?: string;
  modalityId?: string;
  levelId?: string;
  status?: string;
};

export function normalizeTeacherDnaFilters(
  params?: SearchParams,
): TeacherDnaFilters {
  return {
    period: isPeriod(params?.period) ? params.period : "this_month",
    teacherId: params?.teacherId ?? "",
    modalityId: params?.modalityId ?? "",
    levelId: params?.levelId ?? "",
    status: isStatus(params?.status) ? params.status : "all",
  };
}

export async function getTeacherDnaDashboardData(
  filters: TeacherDnaFilters,
): Promise<TeacherDnaDashboardData> {
  const supabase = await createClient();
  const period = getPeriodRange(filters.period);
  const [
    teachersResult,
    classesResult,
    modalitiesResult,
    levelsResult,
    assessmentsResult,
  ] = await Promise.all([
    supabase
      .from("staff_members")
      .select("id, full_name, artistic_name, photo_path, status")
      .eq("role", "professor")
      .order("full_name", { ascending: true }),
    supabase
      .from("classes")
      .select("id, name, teacher_id, modality_id, level_id"),
    supabase.from("modalities").select("id, name").order("name", { ascending: true }),
    supabase.from("levels").select("id, name").order("name", { ascending: true }),
    supabase
      .from("teacher_dna_assessments")
      .select(
        "id, teacher_id, class_id, lesson_date, source, overall_score, pillar_scores, strengths, improvements, summary, created_at",
      )
      .gte("lesson_date", period.start)
      .lte("lesson_date", period.end)
      .order("lesson_date", { ascending: false }),
  ]);

  const teachers = ((teachersResult.data ?? []) as TeacherDnaTeacher[]).filter(
    (teacher) => teacher.status === "active",
  );
  const classes = (classesResult.data ?? []) as TeacherDnaClass[];
  const modalities = (modalitiesResult.data ?? []) as TeacherDnaCatalogOption[];
  const levels = (levelsResult.data ?? []) as TeacherDnaCatalogOption[];
  const assessmentsTableAvailable = !isMissingTableError(assessmentsResult.error);

  if (assessmentsResult.error && assessmentsTableAvailable) {
    console.error(
      "[TEACHER DNA] assessments load error",
      assessmentsResult.error.message,
    );
  }

  const classById = new Map(classes.map((danceClass) => [danceClass.id, danceClass]));
  const filteredTeachers = teachers.filter((teacher) =>
    filters.teacherId ? teacher.id === filters.teacherId : true,
  );
  const filteredAssessments = ((assessmentsResult.data ?? []) as Array<
    Omit<TeacherDnaAssessment, "pillar_scores"> & { pillar_scores: unknown }
  >)
    .map(normalizeAssessment)
    .filter((assessment) => {
      const danceClass = assessment.class_id
        ? classById.get(assessment.class_id)
        : null;

      if (filters.teacherId && assessment.teacher_id !== filters.teacherId) {
        return false;
      }

      if (filters.modalityId && danceClass?.modality_id !== filters.modalityId) {
        return false;
      }

      if (filters.levelId && danceClass?.level_id !== filters.levelId) {
        return false;
      }

      return true;
    });
  const scores = buildTeacherDnaScores({
    teachers: filteredTeachers,
    assessments: filteredAssessments,
  }).filter((score) => {
    if (filters.status === "with_assessment") {
      return score.evaluatedLessons > 0;
    }

    if (filters.status === "without_assessment") {
      return score.evaluatedLessons === 0;
    }

    return true;
  });
  const evaluatedScores = scores.filter(
    (score) => typeof score.overallScore === "number",
  );
  const teamPillarScores = buildTeamPillarScores(scores);

  return {
    filters,
    teachers,
    modalities,
    levels,
    teacherScores: scores.sort(
      (a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1),
    ),
    teamAverage: roundScore(
      average(
        evaluatedScores
          .map((score) => score.overallScore)
          .filter((score): score is number => typeof score === "number"),
      ),
    ),
    highlightedTeacher: evaluatedScores.sort(
      (a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0),
    )[0] ?? null,
    strongestPillar: getTeamPillarEdge(teamPillarScores, "max"),
    criticalPillar: getTeamPillarEdge(teamPillarScores, "min"),
    evaluatedTeachersCount: evaluatedScores.length,
    assessedLessonsCount: filteredAssessments.length,
    teamPillarScores,
    monthlyEvolution: buildMonthlyEvolution(filteredAssessments),
    assessmentsTableAvailable,
  };
}

export async function getTeacherDnaDetailData(
  teacherId: string,
  filters: TeacherDnaFilters,
) {
  const data = await getTeacherDnaDashboardData({ ...filters, teacherId });
  const teacherScore =
    data.teacherScores.find((score) => score.teacher.id === teacherId) ?? null;

  return {
    ...data,
    teacherScore,
  };
}

export function getTeacherDnaQuery(filters: TeacherDnaFilters) {
  const params = new URLSearchParams();
  params.set("period", filters.period);

  if (filters.teacherId) {
    params.set("teacherId", filters.teacherId);
  }

  if (filters.modalityId) {
    params.set("modalityId", filters.modalityId);
  }

  if (filters.levelId) {
    params.set("levelId", filters.levelId);
  }

  if (filters.status !== "all") {
    params.set("status", filters.status);
  }

  return params.toString();
}

function normalizeAssessment(
  assessment: Omit<TeacherDnaAssessment, "pillar_scores"> & {
    pillar_scores: unknown;
  },
): TeacherDnaAssessment {
  const pillarScores =
    assessment.pillar_scores && typeof assessment.pillar_scores === "object"
      ? (assessment.pillar_scores as Partial<Record<TeacherDnaPillarKey, number>>)
      : {};

  return {
    ...assessment,
    overall_score: Number(assessment.overall_score ?? 0),
    pillar_scores: pillarScores,
  };
}

function getPeriodRange(period: TeacherDnaPeriod) {
  const now = new Date();
  const end = toDateString(now);
  const startDate = new Date(now);

  if (period === "this_month") {
    startDate.setDate(1);
  } else if (period === "last_30") {
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === "last_90") {
    startDate.setDate(startDate.getDate() - 90);
  } else {
    startDate.setMonth(0, 1);
  }

  return {
    start: toDateString(startDate),
    end,
  };
}

function buildMonthlyEvolution(assessments: TeacherDnaAssessment[]) {
  const grouped = new Map<string, number[]>();

  for (const assessment of assessments) {
    const date = assessment.lesson_date ?? assessment.created_at.slice(0, 10);
    const label = date.slice(0, 7);
    const score =
      assessment.overall_score > 0
        ? assessment.overall_score
        : average(
            teacherDnaPillars
              .map((pillar) => Number(assessment.pillar_scores[pillar.key]))
              .filter((value) => Number.isFinite(value)),
          );

    if (typeof score === "number") {
      grouped.set(label, [...(grouped.get(label) ?? []), score]);
    }
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, values]) => ({ label, score: roundScore(average(values)) }));
}

function getTeamPillarEdge(
  scores: Record<TeacherDnaPillarKey, number | null>,
  mode: "min" | "max",
) {
  const scored = teacherDnaPillars.reduce<
    Array<{ key: TeacherDnaPillarKey; name: string; score: number }>
  >((rows, pillar) => {
    const score = scores[pillar.key];

    if (typeof score === "number") {
      rows.push({
        key: pillar.key,
        name: pillar.name,
        score,
      });
    }

    return rows;
  }, []);

  if (scored.length === 0) {
    return null;
  }

  return scored.sort((a, b) =>
    mode === "max" ? b.score - a.score : a.score - b.score,
  )[0];
}

function isPeriod(value: string | undefined): value is TeacherDnaPeriod {
  return teacherDnaPeriodOptions.some((option) => option.value === value);
}

function isStatus(value: string | undefined): value is TeacherDnaStatusFilter {
  return value === "all" || value === "with_assessment" || value === "without_assessment";
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getTeacherName(teacher: TeacherDnaTeacher) {
  return getStaffDisplayName({
    full_name: teacher.full_name,
    artistic_name: teacher.artistic_name,
  });
}
