import { createClient } from "@/lib/supabase/server";
import { getStaffDisplayName } from "@/features/staff/formatters";
import {
  getTeacherDnaDashboardData,
  normalizeTeacherDnaFilters,
} from "@/features/teacher-dna/queries";

export type SchoolGroupMetric = {
  id: string | null;
  name: string;
  classesCount: number;
  activeEnrollments: number;
  monthlyRevenue: number;
};

export type SchoolTeacherMetric = SchoolGroupMetric & {
  dnaScore: number | null;
};

export type SchoolMetrics = {
  available: boolean;
  activeStudents: number;
  activeEnrollments: number;
  activeClasses: number;
  teachersActive: number;
  totalCapacity: number;
  monthlyRevenue: number;
  averageTicket: number | null;
  occupancyRate: number | null;
  dnaTeamAverage: number | null;
  perModality: SchoolGroupMetric[];
  perLevel: SchoolGroupMetric[];
  perTeacher: SchoolTeacherMetric[];
};

type ClassRow = {
  id: string;
  name: string;
  capacity: number | null;
  status: string;
  teacher_id: string | null;
  modality_id: string | null;
  level_id: string | null;
};

type EnrollmentRow = {
  class_id: string;
  student_id: string;
  status: string;
  monthly_amount: number | null;
  discount_amount: number | null;
};

type CatalogRow = { id: string; name: string };

const activeEnrollmentStatus = "active";
const inactiveClassStatus = "inactive";

function emptyMetrics(available: boolean): SchoolMetrics {
  return {
    available,
    activeStudents: 0,
    activeEnrollments: 0,
    activeClasses: 0,
    teachersActive: 0,
    totalCapacity: 0,
    monthlyRevenue: 0,
    averageTicket: null,
    occupancyRate: null,
    dnaTeamAverage: null,
    perModality: [],
    perLevel: [],
    perTeacher: [],
  };
}

function netAmount(enrollment: EnrollmentRow) {
  const gross = Number(enrollment.monthly_amount ?? 0);
  const discount = Number(enrollment.discount_amount ?? 0);

  return Math.max(0, gross - discount);
}

function aggregateGroups(
  activeClasses: ClassRow[],
  activeEnrollments: EnrollmentRow[],
  classById: Map<string, ClassRow>,
  keyOf: (danceClass: ClassRow) => string | null,
  nameOf: (id: string | null) => string,
): SchoolGroupMetric[] {
  const groups = new Map<string, SchoolGroupMetric>();

  const bucketFor = (id: string | null) => {
    const key = id ?? "__none__";
    let bucket = groups.get(key);

    if (!bucket) {
      bucket = {
        id,
        name: nameOf(id),
        classesCount: 0,
        activeEnrollments: 0,
        monthlyRevenue: 0,
      };
      groups.set(key, bucket);
    }

    return bucket;
  };

  for (const danceClass of activeClasses) {
    bucketFor(keyOf(danceClass)).classesCount += 1;
  }

  for (const enrollment of activeEnrollments) {
    const danceClass = classById.get(enrollment.class_id);

    if (!danceClass) {
      continue;
    }

    const bucket = bucketFor(keyOf(danceClass));
    bucket.activeEnrollments += 1;
    bucket.monthlyRevenue += netAmount(enrollment);
  }

  return [...groups.values()].sort(
    (a, b) => b.monthlyRevenue - a.monthlyRevenue,
  );
}

async function getDnaSnapshot() {
  try {
    const data = await getTeacherDnaDashboardData(normalizeTeacherDnaFilters());
    const scoreByTeacher = new Map<string, number | null>(
      data.teacherScores.map((score) => [score.teacher.id, score.overallScore]),
    );

    return {
      teamAverage: data.teamAverage,
      teachersActive: data.teachers.length,
      scoreByTeacher,
    };
  } catch (error) {
    console.error(
      "[SCHOOL METRICS] dna snapshot error",
      error instanceof Error ? error.message : error,
    );

    return {
      teamAverage: null,
      teachersActive: 0,
      scoreByTeacher: new Map<string, number | null>(),
    };
  }
}

export async function getSchoolMetrics(): Promise<SchoolMetrics> {
  try {
    const supabase = await createClient();
    const [
      classesResult,
      enrollmentsResult,
      modalitiesResult,
      levelsResult,
      staffResult,
      dna,
    ] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name, capacity, status, teacher_id, modality_id, level_id"),
      supabase
        .from("enrollments")
        .select("class_id, student_id, status, monthly_amount, discount_amount"),
      supabase.from("modalities").select("id, name"),
      supabase.from("levels").select("id, name"),
      supabase.from("staff_members").select("id, full_name, artistic_name"),
      getDnaSnapshot(),
    ]);

    if (classesResult.error || enrollmentsResult.error) {
      console.error(
        "[SCHOOL METRICS] core load error",
        classesResult.error?.message ?? enrollmentsResult.error?.message,
      );
      return emptyMetrics(false);
    }

    const classes = (classesResult.data ?? []) as ClassRow[];
    const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[];
    const modalities = (modalitiesResult.data ?? []) as CatalogRow[];
    const levels = (levelsResult.data ?? []) as CatalogRow[];
    const staff = (staffResult.data ?? []) as Array<{
      id: string;
      full_name: string;
      artistic_name: string | null;
    }>;

    const classById = new Map(classes.map((danceClass) => [danceClass.id, danceClass]));
    const activeClasses = classes.filter(
      (danceClass) => danceClass.status !== inactiveClassStatus,
    );
    const activeEnrollments = enrollments.filter(
      (enrollment) => enrollment.status === activeEnrollmentStatus,
    );

    const modalityName = new Map(modalities.map((row) => [row.id, row.name]));
    const levelName = new Map(levels.map((row) => [row.id, row.name]));
    const teacherName = new Map(
      staff.map((member) => [member.id, getStaffDisplayName(member)]),
    );

    const distinctStudents = new Set(
      activeEnrollments.map((enrollment) => enrollment.student_id),
    );
    const monthlyRevenue = activeEnrollments.reduce(
      (sum, enrollment) => sum + netAmount(enrollment),
      0,
    );
    const totalCapacity = activeClasses.reduce(
      (sum, danceClass) => sum + (danceClass.capacity ?? 0),
      0,
    );

    const perTeacher = aggregateGroups(
      activeClasses,
      activeEnrollments,
      classById,
      (danceClass) => danceClass.teacher_id,
      (id) => (id ? teacherName.get(id) ?? "Professor removido" : "Sem professor"),
    ).map<SchoolTeacherMetric>((group) => ({
      ...group,
      dnaScore: group.id ? dna.scoreByTeacher.get(group.id) ?? null : null,
    }));

    return {
      available: true,
      activeStudents: distinctStudents.size,
      activeEnrollments: activeEnrollments.length,
      activeClasses: activeClasses.length,
      teachersActive: dna.teachersActive,
      totalCapacity,
      monthlyRevenue,
      averageTicket:
        distinctStudents.size > 0 ? monthlyRevenue / distinctStudents.size : null,
      occupancyRate:
        totalCapacity > 0 ? activeEnrollments.length / totalCapacity : null,
      dnaTeamAverage: dna.teamAverage,
      perModality: aggregateGroups(
        activeClasses,
        activeEnrollments,
        classById,
        (danceClass) => danceClass.modality_id,
        (id) => (id ? modalityName.get(id) ?? "Modalidade removida" : "Sem modalidade"),
      ),
      perLevel: aggregateGroups(
        activeClasses,
        activeEnrollments,
        classById,
        (danceClass) => danceClass.level_id,
        (id) => (id ? levelName.get(id) ?? "Nível removido" : "Sem nível"),
      ),
      perTeacher,
    };
  } catch (error) {
    console.error(
      "[SCHOOL METRICS] unexpected error",
      error instanceof Error ? error.message : error,
    );
    return emptyMetrics(false);
  }
}
