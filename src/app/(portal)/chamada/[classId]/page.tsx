import Link from "next/link";
import { AttendanceSheet } from "@/features/attendance/attendance-sheet";
import {
  type AttendanceClassSheet,
  type AttendanceStudent,
  normalizeAttendanceMonth,
} from "@/features/attendance/data";
import type { ClassScheduleWeekday, ClassStatus } from "@/features/classes/schemas";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { CatalogOption } from "@/features/class-catalog/types";
import type { TeacherOption } from "@/features/staff/types";
import { PrintButton } from "@/features/print/print-button";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const weekdayMap: Record<ClassScheduleWeekday, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const weekdayLabel: Record<ClassScheduleWeekday, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

const weekdayOrder = new Map(
  Object.entries(weekdayMap).map(([weekday, day]) => [
    weekday as ClassScheduleWeekday,
    day,
  ]),
);

type ChamadaTurmaPageProps = {
  params: Promise<{
    classId: string;
  }>;
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function ChamadaTurmaPage({
  params,
  searchParams,
}: ChamadaTurmaPageProps) {
  const { classId } = await params;
  const query = await searchParams;
  const month = normalizeAttendanceMonth(query?.month);
  const { sheet, schedulesError } = await getChamadaSheet(classId, month);

  if (!sheet) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {schedulesError
          ? "Erro ao carregar horários da turma."
          : "Não foi possível encontrar uma turma ativa para gerar a lista de chamada."}
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/chamada"
          className="text-sm font-medium text-primary hover:underline"
        >
          Voltar para chamada
        </Link>
        <PrintButton />
      </div>

      <AttendanceSheet sheet={sheet} />
    </div>
  );
}

type ChamadaSchedule = {
  id: string;
  class_id: string;
  weekday: ClassScheduleWeekday;
  start_time: string;
  end_time: string;
  room: string | null;
};

type ChamadaClass = {
  id: string;
  name: string;
  category: string | null;
  modality_id: string | null;
  level_id: string | null;
  teacher_id: string | null;
  instructor_name: string | null;
  status: ClassStatus;
};

type ChamadaCalendarEvent = {
  event_type: string;
  start_date: string;
  end_date: string;
  affects_classes: boolean;
  affects_all_classes: boolean;
  class_id: string | null;
  teacher_id: string | null;
  modality_id: string | null;
  level_id: string | null;
};

type ChamadaSheetResult = {
  sheet: AttendanceClassSheet | null;
  schedulesError: unknown;
};

async function getChamadaSheet(
  classId: string,
  month: string,
): Promise<ChamadaSheetResult> {
  const supabase = createAdminClient();

  const [
    { data: danceClass, error: classError },
    { data: schedules, error: schedulesError },
    { data: calendarEvents, error: calendarEventsError },
    { data: teachers, error: teachersError },
    { data: modalities, error: modalitiesError },
    { data: levels, error: levelsError },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, category, modality_id, level_id, teacher_id, instructor_name, status")
      .eq("id", classId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("class_schedules")
      .select("id, class_id, weekday, start_time, end_time, room")
      .eq("class_id", classId)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("calendar_events")
      .select(
        "event_type, start_date, end_date, affects_classes, affects_all_classes, class_id, teacher_id, modality_id, level_id",
      )
      .eq("affects_classes", true)
      .lte("start_date", getMonthEndDate(month))
      .gte("end_date", getMonthStartDate(month)),
    supabase
      .from("staff_members")
      .select("id, full_name, artistic_name")
      .eq("role", "professor"),
    supabase.from("modalities").select("id, name"),
    supabase.from("levels").select("id, name"),
  ]);

  console.log("[chamada] classId", classId);
  console.log("[chamada] schedulesError", schedulesError);
  console.log("[chamada] schedules count", schedules?.length ?? 0);
  console.log("[chamada] schedules", schedules);

  if (schedulesError) {
    return { sheet: null, schedulesError };
  }

  const firstError =
    classError ??
    calendarEventsError ??
    teachersError ??
    modalitiesError ??
    levelsError;

  if (firstError) {
    console.error("[chamada] sheet load error", firstError);
    return { sheet: null, schedulesError: null };
  }

  if (!danceClass) {
    return { sheet: null, schedulesError: null };
  }

  const classData = danceClass as ChamadaClass;
  const classSchedules = (schedules ?? []) as ChamadaSchedule[];
  const students = await getActiveStudents(classId);
  const attendanceDates = getAttendanceDatesForMonth(classSchedules, month);
  const suspendedAttendanceDates = getSuspendedAttendanceDates({
    attendanceDates,
    events: (calendarEvents ?? []) as ChamadaCalendarEvent[],
    danceClass: classData,
    month,
  });

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
  const teacher = classData.teacher_id
    ? teachersById.get(classData.teacher_id) ?? null
    : null;

  return {
    sheet: {
      id: classData.id,
      name: classData.name,
      status: classData.status,
      teacherName: teacher
        ? getStaffDisplayName(teacher)
        : classData.instructor_name || "Não informado",
      modalityName:
        (classData.modality_id
          ? modalitiesById.get(classData.modality_id)?.name
          : null) ??
        classData.category ??
        "Não informado",
      levelName: classData.level_id
        ? levelsById.get(classData.level_id)?.name ?? "Não informado"
        : "Não informado",
      schedules: classSchedules,
      schedulesText: formatSchedules(classSchedules),
      activeStudentsCount: students.length,
      students,
      attendanceDates,
      suspendedAttendanceDates,
      monthLabel: formatMonthLabel(month),
    },
    schedulesError: null,
  };
}

async function getActiveStudents(classId: string): Promise<AttendanceStudent[]> {
  const supabase = createAdminClient();
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select("id, student_id")
    .eq("class_id", classId)
    .eq("status", "active");

  if (enrollmentsError) {
    console.error("[chamada] active enrollments error", enrollmentsError);
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
    console.error("[chamada] students error", studentsError);
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
}

function formatSchedules(schedules: ChamadaSchedule[]) {
  if (schedules.length === 0) {
    return "-";
  }

  return sortSchedules(schedules)
    .map(
      (schedule) =>
        `${weekdayLabel[schedule.weekday]} ${formatTime(schedule.start_time)}-${formatTime(schedule.end_time)}`,
    )
    .join(" | ");
}

function getAttendanceDatesForMonth(schedules: ChamadaSchedule[], month: string) {
  const [yearText, monthText] = normalizeAttendanceMonth(month).split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const weekdays = new Set(
    schedules.map((schedule) => weekdayMap[schedule.weekday]),
  );
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const dates: string[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day);

    if (weekdays.has(date.getDay())) {
      dates.push(
        `${String(day).padStart(2, "0")}/${String(monthIndex + 1).padStart(2, "0")}`,
      );
    }
  }

  return dates;
}

function getSuspendedAttendanceDates({
  attendanceDates,
  events,
  danceClass,
  month,
}: {
  attendanceDates: string[];
  events: ChamadaCalendarEvent[];
  danceClass: ChamadaClass;
  month: string;
}) {
  const affectingEvents = events.filter(
    (event) =>
      event.affects_classes &&
      (event.affects_all_classes ||
        event.class_id === danceClass.id ||
        event.teacher_id === danceClass.teacher_id ||
        event.modality_id === danceClass.modality_id ||
        event.level_id === danceClass.level_id),
  );

  return attendanceDates.filter((date) => {
    const isoDate = displayDateToIsoDate(date, month);

    return affectingEvents.some(
      (event) => event.start_date <= isoDate && event.end_date >= isoDate,
    );
  });
}

function sortSchedules(schedules: ChamadaSchedule[]) {
  return [...schedules].sort((a, b) => {
    const weekdayDiff =
      (weekdayOrder.get(a.weekday) ?? 0) - (weekdayOrder.get(b.weekday) ?? 0);

    if (weekdayDiff !== 0) {
      return weekdayDiff;
    }

    return a.start_time.localeCompare(b.start_time);
  });
}

function getMonthStartDate(month: string) {
  const [yearText, monthText] = normalizeAttendanceMonth(month).split("-");

  return `${yearText}-${monthText}-01`;
}

function getMonthEndDate(month: string) {
  const [yearText, monthText] = normalizeAttendanceMonth(month).split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  return `${yearText}-${monthText}-${String(lastDay).padStart(2, "0")}`;
}

function displayDateToIsoDate(date: string, month: string) {
  const [yearText] = normalizeAttendanceMonth(month).split("-");
  const [day, monthText] = date.split("/");

  return `${yearText}-${monthText}-${day}`;
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = normalizeAttendanceMonth(month).split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}
