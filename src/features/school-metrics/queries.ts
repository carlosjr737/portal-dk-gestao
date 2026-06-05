import { createClient } from "@/lib/supabase/server";
import { formatClassSchedules } from "@/features/classes/formatters";
import type { ClassSchedule } from "@/features/classes/types";
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

export type SchoolClassRevenueMetric = {
  classId: string;
  className: string;
  classStatus: string;
  teacherId: string | null;
  teacherName: string;
  modalityId: string | null;
  modalityName: string;
  levelId: string | null;
  levelName: string;
  scheduleLabel: string;
  capacity: number | null;
  activeStudents: number;
  activeEnrollments: number;
  monthlyRevenue: number;
  totalDiscount: number;
  averageTicketPerEnrollment: number;
  enrollmentsWithoutAmount: number;
  occupancyRate: number | null;
};

export type SchoolMetricFilterOption = {
  id: string;
  name: string;
};

export type SchoolMetrics = {
  available: boolean;
  activeStudents: number;
  activeEnrollments: number;
  activeClasses: number;
  teachersActive: number;
  totalCapacity: number;
  monthlyRevenue: number;
  averageTicketPerEnrollment: number | null;
  averageTicketPerStudent: number | null;
  occupancyRate: number | null;
  dnaTeamAverage: number | null;
  perModality: SchoolGroupMetric[];
  perLevel: SchoolGroupMetric[];
  perTeacher: SchoolTeacherMetric[];
  classRevenue: SchoolClassRevenueMetric[];
  revenueDiagnostics: {
    totalRevenueFromClasses: number;
    revenueDifference: number;
    activeEnrollmentsWithoutClass: number;
    activeEnrollmentsWithoutAmount: number;
    activeEnrollmentsWithZeroAmount: number;
    zeroRevenueClassesWithActiveEnrollments: number;
  };
  filters: {
    teachers: SchoolMetricFilterOption[];
    modalities: SchoolMetricFilterOption[];
    levels: SchoolMetricFilterOption[];
  };
};

type ClassRow = {
  id: string;
  name: string;
  capacity: number | null;
  status: string;
  teacher_id: string | null;
  modality_id: string | null;
  level_id: string | null;
  category: string | null;
  instructor_name: string | null;
  schedule_description: string | null;
};

type EnrollmentRow = {
  class_id: string | null;
  student_id: string;
  status: string;
  monthly_amount: number | null;
  discount_amount: number | null;
};

type CatalogRow = { id: string; name: string };

type ScheduleRow = Pick<
  ClassSchedule,
  "id" | "class_id" | "weekday" | "start_time" | "end_time" | "room"
>;

const activeEnrollmentStatus = "active";
const activeClassStatus = "active";

function emptyMetrics(available: boolean): SchoolMetrics {
  return {
    available,
    activeStudents: 0,
    activeEnrollments: 0,
    activeClasses: 0,
    teachersActive: 0,
    totalCapacity: 0,
    monthlyRevenue: 0,
    averageTicketPerEnrollment: null,
    averageTicketPerStudent: null,
    occupancyRate: null,
    dnaTeamAverage: null,
    perModality: [],
    perLevel: [],
    perTeacher: [],
    classRevenue: [],
    revenueDiagnostics: {
      totalRevenueFromClasses: 0,
      revenueDifference: 0,
      activeEnrollmentsWithoutClass: 0,
      activeEnrollmentsWithoutAmount: 0,
      activeEnrollmentsWithZeroAmount: 0,
      zeroRevenueClassesWithActiveEnrollments: 0,
    },
    filters: {
      teachers: [],
      modalities: [],
      levels: [],
    },
  };
}

function aggregateGroups(
  activeClasses: ClassRow[],
  activeEnrollments: EnrollmentRow[],
  classById: Map<string, ClassRow>,
  groupOf: (danceClass: ClassRow) => { id: string | null; name: string },
): SchoolGroupMetric[] {
  const groups = new Map<string, SchoolGroupMetric>();

  const bucketFor = (group: { id: string | null; name: string }) => {
    const key = group.id ?? `__name__:${group.name}`;
    let bucket = groups.get(key);

    if (!bucket) {
      bucket = {
        id: group.id,
        name: group.name,
        classesCount: 0,
        activeEnrollments: 0,
        monthlyRevenue: 0,
      };
      groups.set(key, bucket);
    }

    return bucket;
  };

  for (const danceClass of activeClasses) {
    bucketFor(groupOf(danceClass)).classesCount += 1;
  }

  for (const enrollment of activeEnrollments) {
    if (!enrollment.class_id) {
      continue;
    }

    const danceClass = classById.get(enrollment.class_id);

    if (!danceClass) {
      continue;
    }

    const bucket = bucketFor(groupOf(danceClass));
    bucket.activeEnrollments += 1;
    bucket.monthlyRevenue += netAmount(enrollment);
  }

  return [...groups.values()].sort(
    (a, b) => b.monthlyRevenue - a.monthlyRevenue,
  );
}

// MRR líquido por matrícula: mensalidade menos desconto, nunca negativo.
// Esta é a definição oficial de receita do projeto e reconcilia com o Conta Azul.
function netAmount(enrollment: EnrollmentRow) {
  const gross = Number(enrollment.monthly_amount ?? 0);
  const discount = Number(enrollment.discount_amount ?? 0);

  return Math.max(0, gross - discount);
}

function missingContractedAmount(enrollment: EnrollmentRow) {
  return (
    enrollment.monthly_amount === null || Number(enrollment.monthly_amount) === 0
  );
}

function splitClassName(className: string) {
  return className
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function textOrNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function getClassModalityName(
  danceClass: ClassRow,
  modalityName: Map<string, string>,
) {
  if (danceClass.modality_id) {
    const officialName = modalityName.get(danceClass.modality_id);

    if (officialName) {
      return officialName;
    }
  }

  return (
    textOrNull(danceClass.category) ??
    splitClassName(danceClass.name)[0] ??
    "Sem modalidade informada"
  );
}

function getClassLevelName(danceClass: ClassRow, levelName: Map<string, string>) {
  if (danceClass.level_id) {
    const officialName = levelName.get(danceClass.level_id);

    if (officialName) {
      return officialName;
    }
  }

  return (
    splitClassName(danceClass.name)[1] ?? "Sem nível informado"
  );
}

function getClassTeacherName(
  danceClass: ClassRow,
  teacherName: Map<string, string>,
) {
  if (danceClass.teacher_id) {
    const officialName = teacherName.get(danceClass.teacher_id);

    if (officialName) {
      return officialName;
    }
  }

  return (
    textOrNull(danceClass.instructor_name) ??
    splitClassName(danceClass.name)[2] ??
    "Não informado"
  );
}

function buildClassRevenueMetrics({
  classes,
  activeEnrollments,
  schedules,
  teacherName,
  modalityName,
  levelName,
}: {
  classes: ClassRow[];
  activeEnrollments: EnrollmentRow[];
  schedules: ScheduleRow[];
  teacherName: Map<string, string>;
  modalityName: Map<string, string>;
  levelName: Map<string, string>;
}) {
  const enrollmentsByClass = new Map<string, EnrollmentRow[]>();

  for (const enrollment of activeEnrollments) {
    if (!enrollment.class_id) {
      continue;
    }

    const items = enrollmentsByClass.get(enrollment.class_id) ?? [];
    items.push(enrollment);
    enrollmentsByClass.set(enrollment.class_id, items);
  }

  const schedulesByClass = new Map<string, ScheduleRow[]>();

  for (const schedule of schedules) {
    const items = schedulesByClass.get(schedule.class_id) ?? [];
    items.push(schedule);
    schedulesByClass.set(schedule.class_id, items);
  }

  return classes
    .map<SchoolClassRevenueMetric>((danceClass) => {
      const classEnrollments = enrollmentsByClass.get(danceClass.id) ?? [];
      const monthlyRevenue = classEnrollments.reduce(
        (sum, enrollment) => sum + netAmount(enrollment),
        0,
      );
      const totalDiscount = classEnrollments.reduce(
        (sum, enrollment) => sum + Number(enrollment.discount_amount ?? 0),
        0,
      );
      const enrollmentsWithoutAmount = classEnrollments.filter(
        missingContractedAmount,
      ).length;
      const activeStudents = new Set(
        classEnrollments.map((enrollment) => enrollment.student_id),
      ).size;
      const activeEnrollments = classEnrollments.length;
      const schedulesForClass = schedulesByClass.get(danceClass.id) ?? [];
      const scheduleLabel =
        schedulesForClass.length > 0
          ? formatClassSchedules(schedulesForClass)
          : danceClass.schedule_description || "-";
      const teacherNameValue = getClassTeacherName(danceClass, teacherName);
      const modalityNameValue = getClassModalityName(danceClass, modalityName);
      const levelNameValue = getClassLevelName(danceClass, levelName);

      return {
        classId: danceClass.id,
        className: danceClass.name,
        classStatus: danceClass.status,
        teacherId: danceClass.teacher_id,
        teacherName: teacherNameValue,
        modalityId: danceClass.modality_id,
        modalityName: modalityNameValue,
        levelId: danceClass.level_id,
        levelName: levelNameValue,
        scheduleLabel,
        capacity: danceClass.capacity,
        activeStudents,
        activeEnrollments,
        monthlyRevenue,
        totalDiscount,
        averageTicketPerEnrollment:
          activeEnrollments > 0 ? monthlyRevenue / activeEnrollments : 0,
        enrollmentsWithoutAmount,
        occupancyRate:
          danceClass.capacity && danceClass.capacity > 0
            ? activeEnrollments / danceClass.capacity
            : null,
      };
    })
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
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
      schedulesResult,
      dna,
    ] = await Promise.all([
      supabase
        .from("classes")
        .select(
          "id, name, category, capacity, status, teacher_id, modality_id, level_id, instructor_name, schedule_description",
        ),
      supabase
        .from("enrollments")
        .select("class_id, student_id, status, monthly_amount, discount_amount"),
      supabase.from("modalities").select("id, name"),
      supabase.from("levels").select("id, name"),
      supabase.from("staff_members").select("id, full_name, artistic_name"),
      supabase
        .from("class_schedules")
        .select("id, class_id, weekday, start_time, end_time, room"),
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
    const schedules = (schedulesResult.data ?? []) as ScheduleRow[];

    const classById = new Map(classes.map((danceClass) => [danceClass.id, danceClass]));
    const activeClasses = classes.filter(
      (danceClass) => danceClass.status === activeClassStatus,
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
    const activeEnrollmentsWithoutClass = activeEnrollments.filter(
      (enrollment) =>
        !enrollment.class_id || !classById.has(enrollment.class_id),
    ).length;
    const activeEnrollmentsWithoutAmount = activeEnrollments.filter(
      (enrollment) => enrollment.monthly_amount === null,
    ).length;
    const activeEnrollmentsWithZeroAmount = activeEnrollments.filter(
      (enrollment) => Number(enrollment.monthly_amount ?? 0) === 0,
    ).length;
    const totalCapacity = activeClasses.reduce(
      (sum, danceClass) => sum + (danceClass.capacity ?? 0),
      0,
    );
    const linkedActiveTeachers = new Set(
      activeClasses
        .map((danceClass) =>
          danceClass.teacher_id ?? textOrNull(danceClass.instructor_name),
        )
        .filter(Boolean),
    );
    const classRevenue = buildClassRevenueMetrics({
      classes,
      activeEnrollments,
      schedules,
      teacherName,
      modalityName,
      levelName,
    });
    const totalRevenueFromClasses = classRevenue.reduce(
      (sum, row) => sum + row.monthlyRevenue,
      0,
    );

    const perTeacher = aggregateGroups(
      activeClasses,
      activeEnrollments,
      classById,
      (danceClass) => ({
        id: danceClass.teacher_id,
        name: getClassTeacherName(danceClass, teacherName),
      }),
    ).map<SchoolTeacherMetric>((group) => ({
      ...group,
      dnaScore: group.id ? dna.scoreByTeacher.get(group.id) ?? null : null,
    }));

    return {
      available: true,
      activeStudents: distinctStudents.size,
      activeEnrollments: activeEnrollments.length,
      activeClasses: activeClasses.length,
      teachersActive: linkedActiveTeachers.size || dna.teachersActive,
      totalCapacity,
      monthlyRevenue,
      averageTicketPerEnrollment:
        activeEnrollments.length > 0
          ? monthlyRevenue / activeEnrollments.length
          : null,
      averageTicketPerStudent:
        distinctStudents.size > 0 ? monthlyRevenue / distinctStudents.size : null,
      occupancyRate:
        totalCapacity > 0 ? activeEnrollments.length / totalCapacity : null,
      dnaTeamAverage: dna.teamAverage,
      perModality: aggregateGroups(
        activeClasses,
        activeEnrollments,
        classById,
        (danceClass) => ({
          id: danceClass.modality_id,
          name: getClassModalityName(danceClass, modalityName),
        }),
      ),
      perLevel: aggregateGroups(
        activeClasses,
        activeEnrollments,
        classById,
        (danceClass) => ({
          id: danceClass.level_id,
          name: getClassLevelName(danceClass, levelName),
        }),
      ),
      perTeacher,
      classRevenue,
      revenueDiagnostics: {
        totalRevenueFromClasses,
        revenueDifference: monthlyRevenue - totalRevenueFromClasses,
        activeEnrollmentsWithoutClass,
        activeEnrollmentsWithoutAmount,
        activeEnrollmentsWithZeroAmount,
        zeroRevenueClassesWithActiveEnrollments: classRevenue.filter(
          (row) => row.monthlyRevenue === 0 && row.activeEnrollments > 0,
        ).length,
      },
      filters: {
        teachers: staff
          .map((member) => ({ id: member.id, name: getStaffDisplayName(member) }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        modalities: modalities
          .map((modality) => ({ id: modality.id, name: modality.name }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        levels: levels
          .map((level) => ({ id: level.id, name: level.name }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      },
    };
  } catch (error) {
    console.error(
      "[SCHOOL METRICS] unexpected error",
      error instanceof Error ? error.message : error,
    );
    return emptyMetrics(false);
  }
}
