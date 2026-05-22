import { createClient } from "@/lib/supabase/server";
import {
  classScheduleWeekdayOptions,
  type ClassScheduleWeekday,
  type ClassStatus,
} from "@/features/classes/schemas";
import type { ClassSchedule, DanceClass } from "@/features/classes/types";
import { formatClassSchedules } from "@/features/classes/formatters";
import type { CatalogOption } from "@/features/class-catalog/types";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { TeacherOption } from "@/features/staff/types";

export type AttendanceFilters = {
  classId?: string;
  teacherId?: string;
  modalityId?: string;
  levelId?: string;
  weekday?: ClassScheduleWeekday;
  status?: Extract<ClassStatus, "active" | "planning">;
  month?: string;
};

export type AttendanceFilterOptions = {
  teachers: TeacherOption[];
  modalities: CatalogOption[];
  levels: CatalogOption[];
};

export type AttendanceClassSummary = {
  id: string;
  name: string;
  status: ClassStatus;
  teacherName: string;
  modalityName: string;
  levelName: string;
  schedules: ClassSchedule[];
  schedulesText: string;
  activeStudentsCount: number;
};

export type AttendanceStudent = {
  enrollmentId: string;
  studentName: string;
};

export type AttendanceClassSheet = AttendanceClassSummary & {
  students: AttendanceStudent[];
  attendanceDates: string[];
  monthLabel: string;
};

export async function getAttendanceFilterOptions(): Promise<AttendanceFilterOptions> {
  const supabase = await createClient();
  const [
    { data: teachers, error: teachersError },
    { data: modalities, error: modalitiesError },
    { data: levels, error: levelsError },
  ] = await Promise.all([
    supabase
      .from("staff_members")
      .select("id, full_name, artistic_name")
      .eq("role", "professor")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    supabase
      .from("modalities")
      .select("id, name")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("levels")
      .select("id, name")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (teachersError) {
    console.error("Attendance teachers filter load error:", teachersError);
  }

  if (modalitiesError) {
    console.error("Attendance modalities filter load error:", modalitiesError);
  }

  if (levelsError) {
    console.error("Attendance levels filter load error:", levelsError);
  }

  return {
    teachers: (teachers ?? []) as TeacherOption[],
    modalities: (modalities ?? []) as CatalogOption[],
    levels: (levels ?? []) as CatalogOption[],
  };
}

export async function getAttendanceClasses(
  filters: AttendanceFilters,
): Promise<AttendanceClassSummary[]> {
  try {
    const supabase = await createClient();
    let classesQuery = supabase
      .from("classes")
      .select(
        "id, name, category, modality_id, level_id, teacher_id, instructor_name, schedule_description, capacity, status, notes, created_at, updated_at",
      )
      .neq("status", "inactive")
      .order("name", { ascending: true });

    classesQuery = classesQuery.eq("status", filters.status ?? "active");

    if (filters.teacherId) {
      classesQuery = classesQuery.eq("teacher_id", filters.teacherId);
    }

    if (filters.classId) {
      classesQuery = classesQuery.eq("id", filters.classId);
    }

    if (filters.modalityId) {
      classesQuery = classesQuery.eq("modality_id", filters.modalityId);
    }

    if (filters.levelId) {
      classesQuery = classesQuery.eq("level_id", filters.levelId);
    }

    const [
      { data: classes, error: classesError },
      { data: enrollments, error: enrollmentsError },
      { data: schedules, error: schedulesError },
      { data: teachers, error: teachersError },
      { data: modalities, error: modalitiesError },
      { data: levels, error: levelsError },
    ] = await Promise.all([
      classesQuery,
      supabase.from("enrollments").select("id, class_id").eq("status", "active"),
      supabase
        .from("class_schedules")
        .select("id, class_id, weekday, start_time, end_time, room, created_at, updated_at"),
      supabase.from("staff_members").select("id, full_name, artistic_name"),
      supabase.from("modalities").select("id, name"),
      supabase.from("levels").select("id, name"),
    ]);

    const firstError =
      classesError ??
      enrollmentsError ??
      schedulesError ??
      teachersError ??
      modalitiesError ??
      levelsError;

    if (firstError) {
      console.error("Attendance classes load error:", firstError);
      return [];
    }

    const activeEnrollmentsByClass = new Map<string, number>();

    for (const enrollment of enrollments ?? []) {
      const classId = enrollment.class_id as string | null;

      if (classId) {
        activeEnrollmentsByClass.set(
          classId,
          (activeEnrollmentsByClass.get(classId) ?? 0) + 1,
        );
      }
    }

    const schedulesByClass = groupSchedules((schedules ?? []) as ClassSchedule[]);
    const teachersById = new Map(
      ((teachers ?? []) as TeacherOption[]).map((teacher) => [
        teacher.id,
        teacher,
      ]),
    );
    const modalitiesById = new Map(
      ((modalities ?? []) as CatalogOption[]).map((modality) => [
        modality.id,
        modality,
      ]),
    );
    const levelsById = new Map(
      ((levels ?? []) as CatalogOption[]).map((level) => [level.id, level]),
    );

    return ((classes ?? []) as DanceClass[])
      .map((danceClass) =>
        toAttendanceClassSummary({
          danceClass,
          schedules: schedulesByClass.get(danceClass.id) ?? [],
          activeStudentsCount: activeEnrollmentsByClass.get(danceClass.id) ?? 0,
          teacher: danceClass.teacher_id
            ? teachersById.get(danceClass.teacher_id) ?? null
            : null,
          modality: danceClass.modality_id
            ? modalitiesById.get(danceClass.modality_id) ?? null
            : null,
          level: danceClass.level_id
            ? levelsById.get(danceClass.level_id) ?? null
            : null,
        }),
      )
      .filter((danceClass) =>
        filters.weekday
          ? danceClass.schedules.some(
              (schedule) => schedule.weekday === filters.weekday,
            )
          : true,
      );
  } catch (error) {
    console.error("Attendance classes load error:", error);
    return [];
  }
}

export async function getAttendanceClassSheet(
  classId: string,
  month = getCurrentMonthValue(),
): Promise<AttendanceClassSheet | null> {
  const classes = await getAttendanceClasses({ status: "active" });
  const danceClass = classes.find((item) => item.id === classId);

  if (!danceClass) {
    return null;
  }

  return {
    ...danceClass,
    students: await getAttendanceStudents(classId),
    attendanceDates: getAttendanceDatesForMonth(danceClass.schedules, month),
    monthLabel: formatMonthLabel(month),
  };
}

export async function getAllAttendanceClassSheets(
  month = getCurrentMonthValue(),
): Promise<
  AttendanceClassSheet[]
> {
  const classes = await getAttendanceClasses({ status: "active" });
  const sheets = await Promise.all(
    classes.map(async (danceClass) => ({
      ...danceClass,
      students: await getAttendanceStudents(danceClass.id),
      attendanceDates: getAttendanceDatesForMonth(danceClass.schedules, month),
      monthLabel: formatMonthLabel(month),
    })),
  );

  return sheets;
}

async function getAttendanceStudents(classId: string): Promise<AttendanceStudent[]> {
  try {
    const supabase = await createClient();
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("enrollments")
      .select("id, student_id")
      .eq("class_id", classId)
      .eq("status", "active");

    if (enrollmentsError) {
      console.error("Attendance enrollments load error:", enrollmentsError);
      return [];
    }

    const studentIds = [
      ...new Set(
        (enrollments ?? [])
          .map((enrollment) => enrollment.student_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const { data: students, error: studentsError } =
      studentIds.length > 0
        ? await supabase.from("students").select("id, full_name").in("id", studentIds)
        : { data: [], error: null };

    if (studentsError) {
      console.error("Attendance students load error:", studentsError);
    }

    const studentsById = new Map(
      (students ?? []).map((student) => [
        student.id as string,
        student.full_name as string,
      ]),
    );

    return (enrollments ?? [])
      .map((enrollment) => {
        const studentId = enrollment.student_id as string | null;

        return {
          enrollmentId: enrollment.id as string,
          studentName: studentId
            ? studentsById.get(studentId) ?? "Aluno não encontrado"
            : "Aluno não encontrado",
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName, "pt-BR"));
  } catch (error) {
    console.error("Attendance students load error:", error);
    return [];
  }
}

function groupSchedules(schedules: ClassSchedule[]) {
  const schedulesByClass = new Map<string, ClassSchedule[]>();

  for (const schedule of schedules) {
    const currentSchedules = schedulesByClass.get(schedule.class_id) ?? [];
    schedulesByClass.set(schedule.class_id, [...currentSchedules, schedule]);
  }

  return schedulesByClass;
}

function toAttendanceClassSummary({
  danceClass,
  schedules,
  activeStudentsCount,
  teacher,
  modality,
  level,
}: {
  danceClass: DanceClass;
  schedules: ClassSchedule[];
  activeStudentsCount: number;
  teacher: TeacherOption | null;
  modality: CatalogOption | null;
  level: CatalogOption | null;
}): AttendanceClassSummary {
  return {
    id: danceClass.id,
    name: danceClass.name,
    status: danceClass.status,
    teacherName: teacher
      ? getStaffDisplayName(teacher)
      : danceClass.instructor_name || "Não informado",
    modalityName: modality?.name ?? danceClass.category ?? "Não informado",
    levelName: level?.name ?? "Não informado",
    schedules,
    schedulesText: formatClassSchedules(schedules),
    activeStudentsCount,
  };
}

export const weekdayOptions = classScheduleWeekdayOptions;

export function getCurrentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizeAttendanceMonth(value: string | undefined) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : getCurrentMonthValue();
}

function getAttendanceDatesForMonth(schedules: ClassSchedule[], month: string) {
  const [yearText, monthText] = normalizeAttendanceMonth(month).split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const weekdays = new Set(schedules.map((schedule) => schedule.weekday));
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const dates: string[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day);
    const weekday = jsWeekdayToClassWeekday(date.getDay());

    if (weekdays.has(weekday)) {
      dates.push(
        `${String(day).padStart(2, "0")}/${String(monthIndex + 1).padStart(2, "0")}`,
      );
    }
  }

  return dates;
}

function jsWeekdayToClassWeekday(day: number): ClassScheduleWeekday {
  const weekdays: ClassScheduleWeekday[] = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];

  return weekdays[day];
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = normalizeAttendanceMonth(month).split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}
