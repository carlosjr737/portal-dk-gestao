import { createClient } from "@/lib/supabase/server";

export type TeacherClassMetric = {
  classId: string;
  name: string;
  status: string;
  capacity: number | null;
  activeStudents: number;
  monthlyRevenue: number;
};

export type TeacherGroupMetric = {
  id: string | null;
  classesCount: number;
  activeStudents: number;
  monthlyRevenue: number;
};

export type TeacherBusinessMetrics = {
  available: boolean;
  classesCount: number;
  activeEnrollments: number;
  activeStudents: number;
  totalCapacity: number;
  monthlyRevenue: number;
  averageTicket: number | null;
  occupancyRate: number | null;
  perClass: TeacherClassMetric[];
  perModality: TeacherGroupMetric[];
  perLevel: TeacherGroupMetric[];
};

type ClassRow = {
  id: string;
  name: string;
  capacity: number | null;
  status: string;
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

const activeEnrollmentStatus = "active";

function emptyMetrics(available: boolean): TeacherBusinessMetrics {
  return {
    available,
    classesCount: 0,
    activeEnrollments: 0,
    activeStudents: 0,
    totalCapacity: 0,
    monthlyRevenue: 0,
    averageTicket: null,
    occupancyRate: null,
    perClass: [],
    perModality: [],
    perLevel: [],
  };
}

function buildGroupMetrics(
  classes: ClassRow[],
  activeEnrollments: EnrollmentRow[],
  keyOf: (danceClass: ClassRow) => string | null,
): TeacherGroupMetric[] {
  const classKeyById = new Map(
    classes.map((danceClass) => [danceClass.id, keyOf(danceClass)]),
  );
  const groups = new Map<
    string,
    { id: string | null; classes: Set<string>; students: Set<string>; revenue: number }
  >();

  for (const danceClass of classes) {
    const key = keyOf(danceClass);
    const bucketKey = key ?? "__none__";
    const bucket = groups.get(bucketKey) ?? {
      id: key,
      classes: new Set<string>(),
      students: new Set<string>(),
      revenue: 0,
    };
    bucket.classes.add(danceClass.id);
    groups.set(bucketKey, bucket);
  }

  for (const enrollment of activeEnrollments) {
    const key = classKeyById.get(enrollment.class_id) ?? null;
    const bucketKey = key ?? "__none__";
    const bucket = groups.get(bucketKey);

    if (!bucket) {
      continue;
    }

    bucket.students.add(enrollment.student_id);
    bucket.revenue += netAmount(enrollment);
  }

  return [...groups.values()]
    .map((bucket) => ({
      id: bucket.id,
      classesCount: bucket.classes.size,
      activeStudents: bucket.students.size,
      monthlyRevenue: bucket.revenue,
    }))
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
}

function netAmount(enrollment: EnrollmentRow) {
  const gross = Number(enrollment.monthly_amount ?? 0);
  const discount = Number(enrollment.discount_amount ?? 0);

  return Math.max(0, gross - discount);
}

export async function getTeacherBusinessMetrics(
  teacherId: string,
): Promise<TeacherBusinessMetrics> {
  try {
    const supabase = await createClient();
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, name, capacity, status, modality_id, level_id")
      .eq("teacher_id", teacherId)
      .order("name", { ascending: true });

    if (classError) {
      console.error("[TEACHER METRICS] classes load error", classError.message);
      return emptyMetrics(false);
    }

    const classes = (classData ?? []) as ClassRow[];

    if (classes.length === 0) {
      return emptyMetrics(true);
    }

    const classIds = classes.map((danceClass) => danceClass.id);
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("class_id, student_id, status, monthly_amount, discount_amount")
      .in("class_id", classIds);

    if (enrollmentError) {
      console.error(
        "[TEACHER METRICS] enrollments load error",
        enrollmentError.message,
      );
      return { ...emptyMetrics(true), classesCount: classes.length };
    }

    const enrollments = (enrollmentData ?? []) as EnrollmentRow[];
    const activeEnrollments = enrollments.filter(
      (enrollment) => enrollment.status === activeEnrollmentStatus,
    );

    const perClassMap = new Map<
      string,
      { students: Set<string>; revenue: number }
    >();

    for (const enrollment of activeEnrollments) {
      const bucket = perClassMap.get(enrollment.class_id) ?? {
        students: new Set<string>(),
        revenue: 0,
      };
      bucket.students.add(enrollment.student_id);
      bucket.revenue += netAmount(enrollment);
      perClassMap.set(enrollment.class_id, bucket);
    }

    const distinctStudents = new Set(
      activeEnrollments.map((enrollment) => enrollment.student_id),
    );
    const monthlyRevenue = activeEnrollments.reduce(
      (sum, enrollment) => sum + netAmount(enrollment),
      0,
    );
    const totalCapacity = classes.reduce(
      (sum, danceClass) => sum + (danceClass.capacity ?? 0),
      0,
    );

    const perClass: TeacherClassMetric[] = classes.map((danceClass) => {
      const bucket = perClassMap.get(danceClass.id);

      return {
        classId: danceClass.id,
        name: danceClass.name,
        status: danceClass.status,
        capacity: danceClass.capacity,
        activeStudents: bucket?.students.size ?? 0,
        monthlyRevenue: bucket?.revenue ?? 0,
      };
    });

    return {
      available: true,
      classesCount: classes.length,
      activeEnrollments: activeEnrollments.length,
      activeStudents: distinctStudents.size,
      totalCapacity,
      monthlyRevenue,
      averageTicket:
        distinctStudents.size > 0
          ? monthlyRevenue / distinctStudents.size
          : null,
      occupancyRate:
        totalCapacity > 0 ? distinctStudents.size / totalCapacity : null,
      perClass,
      perModality: buildGroupMetrics(
        classes,
        activeEnrollments,
        (danceClass) => danceClass.modality_id,
      ),
      perLevel: buildGroupMetrics(
        classes,
        activeEnrollments,
        (danceClass) => danceClass.level_id,
      ),
    };
  } catch (error) {
    console.error(
      "[TEACHER METRICS] unexpected error",
      error instanceof Error ? error.message : error,
    );
    return emptyMetrics(false);
  }
}
