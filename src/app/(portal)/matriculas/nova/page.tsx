import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { createEnrollment } from "@/features/enrollments/actions";
import { EnrollmentForm } from "@/features/enrollments/enrollment-form";
import type {
  EnrollmentClassOption,
  EnrollmentGuardianOption,
  EnrollmentStudentOption,
} from "@/features/enrollments/types";
import {
  formatClassSchedules,
} from "@/features/classes/formatters";
import type { ClassSchedule } from "@/features/classes/types";
import type { CatalogOption } from "@/features/class-catalog/types";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { TeacherOption } from "@/features/staff/types";

export const dynamic = "force-dynamic";

type NovaMatriculaPageProps = {
  searchParams?: Promise<{
    studentId?: string;
    studentSearch?: string;
    classSearch?: string;
    studentCreated?: string;
  }>;
};

export default async function NovaMatriculaPage({
  searchParams,
}: NovaMatriculaPageProps) {
  const params = await searchParams;
  const studentId = params?.studentId?.trim() ?? "";
  const studentSearch = params?.studentSearch?.trim() ?? "";
  const classSearch = params?.classSearch?.trim() ?? "";
  const defaultDueDay = await getDefaultDueDay();
  const today = new Date();
  const defaultStartDate = toDateString(today);
  const defaultEndDate = `${today.getFullYear()}-12-31`;
  const defaultFirstDueDate = calculateNextDueDate(defaultDueDay, today);

  const [studentResults, selectedStudent, classes, guardianLinks] =
    await Promise.all([
      getStudentResults(studentSearch, studentId),
      studentId ? getStudentById(studentId) : Promise.resolve(null),
      getClassResults(classSearch),
      getGuardianLinks(studentSearch, studentId),
    ]);

  const students = selectedStudent
    ? [
        selectedStudent,
        ...studentResults.filter((student) => student.id !== selectedStudent.id),
      ]
    : studentResults;

  return (
    <div>
      <PageHeader
        title="Nova matrícula"
        description="Vincule um aluno a uma turma com vigência e responsável financeiro."
      />

      {params?.studentCreated ? (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Aluno criado com sucesso. Continue para matricular agora ou volte para
          a lista de alunos quando quiser.
        </div>
      ) : null}

      <EnrollmentForm
        action={createEnrollment}
        students={students}
        initialStudentId={studentId}
        initialStudentSearch={studentSearch}
        initialClassSearch={classSearch}
        defaultStartDate={defaultStartDate}
        defaultEndDate={defaultEndDate}
        defaultFirstDueDate={defaultFirstDueDate}
        classes={classes}
        guardianLinks={guardianLinks}
      />
    </div>
  );
}

async function getDefaultDueDay() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_provider_settings")
    .select("default_due_day")
    .eq("provider", "conta_azul")
    .maybeSingle();

  if (error) {
    console.error("Enrollment default due day load error:", error.message);
  }

  return typeof data?.default_due_day === "number" ? data.default_due_day : 5;
}

function calculateNextDueDate(defaultDueDay: number, baseDate = new Date()) {
  let dueDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    clampDay(baseDate.getFullYear(), baseDate.getMonth(), defaultDueDay),
  );

  if (dueDate < startOfToday(baseDate)) {
    const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
    dueDate = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      clampDay(nextMonth.getFullYear(), nextMonth.getMonth(), defaultDueDay),
    );
  }

  return toDateString(dueDate);
}

function clampDay(year: number, month: number, day: number) {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

function startOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function getStudentResults(
  search: string,
  selectedStudentId: string,
): Promise<EnrollmentStudentOption[]> {
  if (!search && !selectedStudentId) {
    return [];
  }

  try {
    const supabase = await createClient();
    const studentIdsFromGuardians = search
      ? await getStudentIdsFromGuardianSearch(search)
      : [];
    const normalizedSearch = search.replaceAll(",", " ");

    let query = supabase
      .from("students")
      .select("id, full_name, status, phone, email")
      .order("full_name", { ascending: true })
      .limit(12);

    if (search) {
      query = query.or(
        `full_name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%`,
      );
    } else {
      query = query.eq("id", selectedStudentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Enrollment student search error:", error);
      return [];
    }

    const directStudents = (data ?? []) as Array<{
      id: string;
      full_name: string;
      status: string;
      phone: string | null;
      email: string | null;
    }>;

    const missingGuardianStudentIds = studentIdsFromGuardians.filter(
      (id) => !directStudents.some((student) => student.id === id),
    );

    const guardianStudents = missingGuardianStudentIds.length
      ? await getStudentsByIds(missingGuardianStudentIds)
      : [];

    return hydrateFinancialGuardians([
      ...directStudents,
      ...guardianStudents,
    ]).then((students) => students.slice(0, 12));
  } catch (error) {
    console.error(
      "Enrollment student search error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function getStudentById(
  studentId: string,
): Promise<EnrollmentStudentOption | null> {
  const students = await getStudentsByIds([studentId]);
  const hydrated = await hydrateFinancialGuardians(students);

  return hydrated[0] ?? null;
}

async function getStudentsByIds(
  studentIds: string[],
): Promise<
  Array<{
    id: string;
    full_name: string;
    status: string;
    phone: string | null;
    email: string | null;
  }>
> {
  if (studentIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, status, phone, email")
    .in("id", studentIds);

  if (error) {
    console.error("Enrollment students by id error:", error);
    return [];
  }

  return (data ?? []) as Array<{
    id: string;
    full_name: string;
    status: string;
    phone: string | null;
    email: string | null;
  }>;
}

async function getStudentIdsFromGuardianSearch(search: string) {
  const supabase = await createClient();
  const normalizedSearch = search.replaceAll(",", " ");
  const { data: guardians, error } = await supabase
    .from("guardians")
    .select("id")
    .or(
      `full_name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%`,
    )
    .limit(12);

  if (error || !guardians?.length) {
    if (error) {
      console.error("Enrollment guardian search error:", error);
    }
    return [];
  }

  const guardianIds = guardians.map((guardian) => guardian.id as string);
  const { data: links, error: linksError } = await supabase
    .from("student_guardians")
    .select("student_id")
    .in("guardian_id", guardianIds);

  if (linksError) {
    console.error("Enrollment guardian student links error:", linksError);
    return [];
  }

  return Array.from(
    new Set((links ?? []).map((link) => link.student_id as string)),
  );
}

async function hydrateFinancialGuardians(
  students: Array<{
    id: string;
    full_name: string;
    status: string;
    phone: string | null;
    email: string | null;
  }>,
): Promise<EnrollmentStudentOption[]> {
  if (students.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const studentIds = students.map((student) => student.id);
  const { data: links, error } = await supabase
    .from("student_guardians")
    .select(
      "student_id, guardian:guardians!student_guardians_guardian_id_fkey(full_name, phone)",
    )
    .in("student_id", studentIds)
    .eq("is_financial_responsible", true);

  if (error) {
    console.error("Enrollment financial guardians hydrate error:", error);
  }

  const financialByStudent = new Map<
    string,
    { full_name: string; phone: string | null }
  >();

  for (const link of links ?? []) {
    const guardian = normalizeGuardian(link.guardian);
    const studentId = link.student_id as string;

    if (guardian && !financialByStudent.has(studentId)) {
      financialByStudent.set(studentId, guardian);
    }
  }

  return students.map((student) => {
    const financialGuardian = financialByStudent.get(student.id);

    return {
      ...student,
      financialGuardianName: financialGuardian?.full_name ?? null,
      financialGuardianPhone: financialGuardian?.phone ?? null,
    };
  });
}

async function getClassResults(
  search: string,
): Promise<EnrollmentClassOption[]> {
  try {
    const supabase = await createClient();
    const [
      { data: classes, error },
      { data: teachers, error: teachersError },
      { data: schedules, error: schedulesError },
      { data: enrollments, error: enrollmentsError },
      { data: modalities, error: modalitiesError },
      { data: levels, error: levelsError },
    ] = await Promise.all([
      supabase
        .from("classes")
        .select(
          "id, name, category, modality_id, level_id, teacher_id, instructor_name, capacity",
        )
        .neq("status", "inactive")
        .order("name", { ascending: true }),
      supabase
        .from("staff_members")
        .select("id, full_name, artistic_name")
        .eq("role", "professor"),
      supabase
        .from("class_schedules")
        .select("id, class_id, weekday, start_time, end_time, room, created_at, updated_at"),
      supabase.from("enrollments").select("class_id").eq("status", "active"),
      supabase.from("modalities").select("id, name"),
      supabase.from("levels").select("id, name"),
    ]);

    const firstError =
      error ??
      teachersError ??
      schedulesError ??
      enrollmentsError ??
      modalitiesError ??
      levelsError;

    if (firstError) {
      console.error("Enrollment class search error:", firstError);
      return [];
    }

    const teachersById = new Map(
      ((teachers ?? []) as TeacherOption[]).map((teacher) => [
        teacher.id,
        teacher,
      ]),
    );
    const schedulesByClass = new Map<string, ClassSchedule[]>();
    const activeEnrollmentsByClass = new Map<string, number>();
    const modalitiesById = new Map(
      ((modalities ?? []) as CatalogOption[]).map((modality) => [
        modality.id,
        modality,
      ]),
    );
    const levelsById = new Map(
      ((levels ?? []) as CatalogOption[]).map((level) => [level.id, level]),
    );

    for (const schedule of (schedules ?? []) as ClassSchedule[]) {
      const currentSchedules = schedulesByClass.get(schedule.class_id) ?? [];
      schedulesByClass.set(schedule.class_id, [...currentSchedules, schedule]);
    }

    for (const enrollment of enrollments ?? []) {
      const classId = enrollment.class_id as string | null;

      if (classId) {
        activeEnrollmentsByClass.set(
          classId,
          (activeEnrollmentsByClass.get(classId) ?? 0) + 1,
        );
      }
    }

    const normalizedSearch = search.toLocaleLowerCase("pt-BR");

    return (classes ?? [])
      .map((danceClass) => {
        const teacher =
          typeof danceClass.teacher_id === "string"
            ? teachersById.get(danceClass.teacher_id)
            : null;
        const teacherName = teacher
          ? getStaffDisplayName(teacher)
          : ((danceClass.instructor_name as string | null) ?? null);
        const modalityName =
          typeof danceClass.modality_id === "string"
            ? modalitiesById.get(danceClass.modality_id)?.name
            : null;
        const levelName =
          typeof danceClass.level_id === "string"
            ? levelsById.get(danceClass.level_id)?.name
            : null;

        return {
          id: danceClass.id as string,
          name: danceClass.name as string,
          category:
            modalityName ?? ((danceClass.category as string | null) ?? null),
          level: levelName ?? null,
          capacity: (danceClass.capacity as number | null) ?? null,
          teacherName,
          schedulesLabel: formatClassSchedules(
            schedulesByClass.get(danceClass.id as string) ?? [],
          ),
          activeEnrollmentsCount:
            activeEnrollmentsByClass.get(danceClass.id as string) ?? 0,
        };
      })
      .filter((danceClass) => {
        if (!normalizedSearch) {
          return true;
        }

        return [
          danceClass.name,
          danceClass.category,
          danceClass.level,
          danceClass.teacherName,
        ].some((value) =>
          value?.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
        );
      })
      .slice(0, 12);
  } catch (error) {
    console.error(
      "Enrollment class search error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function getGuardianLinks(
  search: string,
  selectedStudentId: string,
): Promise<EnrollmentGuardianOption[]> {
  const students = await getStudentResults(search, selectedStudentId);
  const studentIds = students.map((student) => student.id);

  if (studentIds.length === 0) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("student_guardians")
      .select(
        "id, student_id, guardian_id, relationship_type, relationship, is_primary, is_financial_responsible, guardian:guardians!student_guardians_guardian_id_fkey(id, full_name, phone)",
      )
      .in("student_id", studentIds)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Enrollment guardians load error:", error);
      return [];
    }

    return (data ?? []).flatMap((link) => {
      const guardian = normalizeGuardian(link.guardian);

      if (!guardian) {
        return [];
      }

      return {
        id: link.id as string,
        student_id: link.student_id as string,
        guardian_id: link.guardian_id as string,
        guardian_name: guardian.full_name,
        relationship_type:
          (link.relationship as string | null) ??
          (link.relationship_type as string | null) ??
          null,
        phone: guardian.phone,
        is_primary: Boolean(link.is_primary),
        is_financial_responsible: Boolean(link.is_financial_responsible),
      };
    });
  } catch (error) {
    console.error(
      "Enrollment guardians load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function normalizeGuardian(
  value: unknown,
): { full_name: string; phone: string | null } | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  const guardian = value as {
    full_name?: unknown;
    phone?: unknown;
  };

  if (typeof guardian.full_name !== "string") {
    return null;
  }

  return {
    full_name: guardian.full_name,
    phone: typeof guardian.phone === "string" ? guardian.phone : null,
  };
}
