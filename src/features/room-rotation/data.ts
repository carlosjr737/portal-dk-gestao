import "server-only";

import {
  classScheduleWeekdayOptions,
  type ClassScheduleWeekday,
} from "@/features/classes/schemas";
import { formatScheduleTime } from "@/features/classes/formatters";
import type { CatalogOption } from "@/features/class-catalog/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { TeacherOption } from "@/features/staff/types";
import {
  dayGroupWeekdays,
  roomRotationDayGroupOptions,
  roomRotationLabels,
} from "@/features/room-rotation/constants";
import type {
  Room,
  RoomRotationAssignment,
  RoomRotationClassCard,
  RoomRotationConflict,
  RoomRotationDayGroup,
  RoomRotationPageData,
  RoomRotationPlan,
} from "@/features/room-rotation/types";

const defaultTimeSlots = buildDefaultTimeSlots();

const defaultRooms = [
  { name: "Subway", slug: "subway", color: "#dbeafe", sort_order: 1 },
  { name: "Pequena", slug: "pequena", color: "#dcfce7", sort_order: 2 },
  { name: "Aquário", slug: "aquario", color: "#fef3c7", sort_order: 3 },
  { name: "Mirante", slug: "mirante", color: "#fce7f3", sort_order: 4 },
];

type RoomRotationFilters = {
  year: number;
  month: number;
  dayGroup: RoomRotationDayGroup;
  rotationLabel: string;
  status?: "draft" | "published" | "";
};

type ClassRecord = {
  id: string;
  name: string;
  category: string | null;
  modality_id: string | null;
  level_id: string | null;
  teacher_id: string | null;
  instructor_name: string | null;
  status: string;
};

type ScheduleRecord = {
  class_id: string;
  weekday: ClassScheduleWeekday;
  start_time: string;
  end_time: string;
  room: string | null;
};

export function getCurrentRoomRotationDefaults() {
  const today = new Date();

  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    dayGroup: "SEG_QUA" as RoomRotationDayGroup,
    rotationLabel: "Rodízio 1",
  };
}

export function normalizeRoomRotationFilters(params?: {
  year?: string;
  month?: string;
  dayGroup?: string;
  rotationLabel?: string;
  status?: string;
}): RoomRotationFilters {
  const defaults = getCurrentRoomRotationDefaults();
  const year = Number(params?.year);
  const month = Number(params?.month);
  const dayGroup = roomRotationDayGroupOptions.some(
    (option) => option.value === params?.dayGroup,
  )
    ? (params?.dayGroup as RoomRotationDayGroup)
    : defaults.dayGroup;
  const rotationLabel = roomRotationLabels.some(
    (label) => label === params?.rotationLabel,
  )
    ? String(params?.rotationLabel)
    : defaults.rotationLabel;

  return {
    year: Number.isInteger(year) && year >= 2000 ? year : defaults.year,
    month: Number.isInteger(month) && month >= 1 && month <= 12
      ? month
      : defaults.month,
    dayGroup,
    rotationLabel,
    status:
      params?.status === "draft" || params?.status === "published"
        ? params.status
        : "draft",
  };
}

export async function getRoomRotationPageData(
  filters: RoomRotationFilters,
): Promise<RoomRotationPageData> {
  const supabase = createAdminClient();
  const [
    { data: rooms, error: roomsError },
    { data: plans, error: plansError },
    { data: classes, error: classesError },
    { data: schedules, error: schedulesError },
    { data: enrollments, error: enrollmentsError },
    { data: teachers, error: teachersError },
    { data: modalities, error: modalitiesError },
    { data: levels, error: levelsError },
  ] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, name, slug, capacity, color, sort_order, active")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("room_rotation_plans")
      .select("id, name, year, month, day_group, rotation_label, status, notes")
      .eq("year", filters.year)
      .eq("month", filters.month)
      .eq("day_group", filters.dayGroup)
      .order("rotation_label", { ascending: true }),
    supabase
      .from("classes")
      .select("id, name, category, modality_id, level_id, teacher_id, instructor_name, status")
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("class_schedules")
      .select("class_id, weekday, start_time, end_time, room"),
    supabase.from("enrollments").select("id, class_id").eq("status", "active"),
    supabase.from("staff_members").select("id, full_name, artistic_name"),
    supabase.from("modalities").select("id, name"),
    supabase.from("levels").select("id, name"),
  ]);

  const firstError =
    roomsError ??
    plansError ??
    classesError ??
    schedulesError ??
    enrollmentsError ??
    teachersError ??
    modalitiesError ??
    levelsError;

  if (firstError) {
    console.error("[ROOM ROTATION] load error", firstError);
  }

  let activeRooms = (rooms ?? []) as Room[];

  if (roomsError || activeRooms.length === 0) {
    activeRooms = await ensureDefaultRooms();
  }

  console.log("[ROOMS] loaded", {
    roomsCount: activeRooms.length,
    roomNames: activeRooms.map((room) => room.name),
    source: roomsError ? "ensure_failed_or_missing_table" : "rooms",
  });

  const allPlans = (plans ?? []) as RoomRotationPlan[];
  const typedPlans = allPlans.filter((plan) =>
    filters.status ? plan.status === filters.status : true,
  );
  const matchingPlans = allPlans.filter(
    (plan) => plan.rotation_label === filters.rotationLabel,
  );
  const selectedPlan =
    matchingPlans.find((plan) => plan.status === "draft") ??
    matchingPlans.find((plan) => plan.status === filters.status) ??
    matchingPlans[0] ??
    null;

  console.log("[ROOM ROTATION] current plan", {
    selectedPlanId: selectedPlan?.id ?? null,
    status: selectedPlan?.status ?? null,
    filters,
  });

  const assignments = selectedPlan
    ? await getAssignments(selectedPlan.id)
    : [];
  const classCards = buildClassCards({
    classes: (classes ?? []) as ClassRecord[],
    schedules: (schedules ?? []) as ScheduleRecord[],
    enrollments: enrollments ?? [],
    teachers: (teachers ?? []) as TeacherOption[],
    modalities: (modalities ?? []) as CatalogOption[],
    levels: (levels ?? []) as CatalogOption[],
    dayGroup: filters.dayGroup,
  });
  const timeSlots = buildTimeSlots(classCards, assignments);
  const conflicts = buildConflicts({
    assignments,
    classes: classCards,
    rooms: activeRooms,
    timeSlots,
  });

  return {
    rooms: activeRooms,
    plans: typedPlans,
    selectedPlan,
    assignments,
    classes: classCards,
    timeSlots,
    conflicts,
  };
}

async function ensureDefaultRooms() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rooms")
    .upsert(
      defaultRooms.map((room) => ({ ...room, active: true })),
      { onConflict: "slug" },
    )
    .select("id, name, slug, capacity, color, sort_order, active")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error(
      "[ROOM ROTATION ROOMS ERROR] failed to ensure default rooms",
      error,
    );
    return [];
  }

  const activeRooms = (data ?? []) as Room[];

  return activeRooms;
}

export function buildRoomRotationQuery(filters: RoomRotationFilters) {
  const params = new URLSearchParams();
  params.set("year", String(filters.year));
  params.set("month", String(filters.month));
  params.set("dayGroup", filters.dayGroup);
  params.set("rotationLabel", filters.rotationLabel);

  if (filters.status) {
    params.set("status", filters.status);
  }

  return params.toString();
}

async function getAssignments(rotationPlanId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("room_rotation_assignments")
    .select("id, rotation_plan_id, class_id, room_id, start_time, end_time, day_group, sort_order, notes")
    .eq("rotation_plan_id", rotationPlanId)
    .order("start_time", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[ROOM ROTATION] assignments load error", error);
    return [];
  }

  return (data ?? []) as RoomRotationAssignment[];
}

function buildClassCards({
  classes,
  schedules,
  enrollments,
  teachers,
  modalities,
  levels,
  dayGroup,
}: {
  classes: ClassRecord[];
  schedules: ScheduleRecord[];
  enrollments: Array<{ class_id?: string | null }>;
  teachers: TeacherOption[];
  modalities: CatalogOption[];
  levels: CatalogOption[];
  dayGroup: RoomRotationDayGroup;
}) {
  const schedulesByClass = new Map<string, ScheduleRecord[]>();
  const activeEnrollmentsByClass = new Map<string, number>();
  const teachersById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const modalitiesById = new Map(
    modalities.map((modality) => [modality.id, modality]),
  );
  const levelsById = new Map(levels.map((level) => [level.id, level]));
  const allowedWeekdays = new Set(dayGroupWeekdays[dayGroup]);

  for (const schedule of schedules) {
    const current = schedulesByClass.get(schedule.class_id) ?? [];
    schedulesByClass.set(schedule.class_id, [...current, schedule]);
  }

  for (const enrollment of enrollments) {
    if (enrollment.class_id) {
      activeEnrollmentsByClass.set(
        enrollment.class_id,
        (activeEnrollmentsByClass.get(enrollment.class_id) ?? 0) + 1,
      );
    }
  }

  return classes
    .map((danceClass): RoomRotationClassCard => {
      const allSchedules = sortSchedules(schedulesByClass.get(danceClass.id) ?? []);
      const matchingSchedules = allSchedules.filter((schedule) =>
        allowedWeekdays.has(schedule.weekday),
      );
      const schedulesForCard =
        matchingSchedules.length > 0 ? matchingSchedules : allSchedules;
      const primarySchedule = schedulesForCard[0] ?? null;
      const teacher = danceClass.teacher_id
        ? teachersById.get(danceClass.teacher_id) ?? null
        : null;

      return {
        id: danceClass.id,
        name: danceClass.name,
        teacherName: teacher
          ? getStaffDisplayName(teacher)
          : danceClass.instructor_name || "Não informado",
        modalityName: danceClass.modality_id
          ? modalitiesById.get(danceClass.modality_id)?.name ?? "Não informado"
          : danceClass.category ?? "Não informado",
        levelName: danceClass.level_id
          ? levelsById.get(danceClass.level_id)?.name ?? "Não informado"
          : "Não informado",
        schedules: schedulesForCard,
        schedulesLabel: formatSchedules(schedulesForCard),
        primaryStartTime: primarySchedule?.start_time.slice(0, 5) ?? null,
        primaryEndTime: primarySchedule?.end_time.slice(0, 5) ?? null,
        activeStudentsCount: activeEnrollmentsByClass.get(danceClass.id) ?? 0,
        status: danceClass.status,
        hasMatchingSchedule: matchingSchedules.length > 0,
        hasAnySchedule: allSchedules.length > 0,
      };
    })
    .filter((danceClass) => danceClass.hasMatchingSchedule || !danceClass.hasAnySchedule)
    .sort((first, second) => {
      const firstTime = first.primaryStartTime ?? "99:99";
      const secondTime = second.primaryStartTime ?? "99:99";

      if (firstTime !== secondTime) {
        return firstTime.localeCompare(secondTime);
      }

      return first.name.localeCompare(second.name, "pt-BR");
    });
}

function buildTimeSlots(
  classes: RoomRotationClassCard[],
  assignments: RoomRotationAssignment[],
) {
  const boundaries = [
    timeToMinutes(defaultTimeSlots[0] ?? "09:00"),
    timeToMinutes("21:30"),
  ];

  for (const danceClass of classes) {
    if (danceClass.primaryStartTime) {
      boundaries.push(timeToMinutes(danceClass.primaryStartTime));
    }

    if (danceClass.primaryEndTime) {
      boundaries.push(timeToMinutes(danceClass.primaryEndTime));
    }
  }

  for (const assignment of assignments) {
    boundaries.push(timeToMinutes(assignment.start_time.slice(0, 5)));

    if (assignment.end_time) {
      boundaries.push(timeToMinutes(assignment.end_time.slice(0, 5)));
    }
  }

  const start = Math.floor(Math.min(...boundaries) / 30) * 30;
  const end = Math.max(...boundaries);
  const slots: string[] = [];

  for (let minutes = start; minutes < end; minutes += 30) {
    slots.push(minutesToTime(minutes));
  }

  return slots.length > 0 ? slots : defaultTimeSlots;
}

function buildConflicts({
  assignments,
  classes,
  rooms,
  timeSlots,
}: {
  assignments: RoomRotationAssignment[];
  classes: RoomRotationClassCard[];
  rooms: Room[];
  timeSlots: string[];
}) {
  const conflicts: RoomRotationConflict[] = [];
  const classById = new Map(classes.map((danceClass) => [danceClass.id, danceClass]));
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const roomTime = new Map<string, RoomRotationAssignment[]>();
  const teacherTime = new Map<string, RoomRotationAssignment[]>();

  for (const assignment of assignments) {
    const danceClass = classById.get(assignment.class_id);
    const time = assignment.start_time.slice(0, 5);
    const roomKey = `${assignment.room_id}-${time}`;
    const teacherKey = `${danceClass?.teacherName ?? ""}-${time}`;
    roomTime.set(roomKey, [...(roomTime.get(roomKey) ?? []), assignment]);
    teacherTime.set(teacherKey, [...(teacherTime.get(teacherKey) ?? []), assignment]);

    if (!roomById.has(assignment.room_id)) {
      conflicts.push({
        type: "missing_room",
        assignmentId: assignment.id,
        classId: assignment.class_id,
        message: "Turma sem sala definida.",
      });
    }

    const room = roomById.get(assignment.room_id);
    if (
      room?.capacity &&
      danceClass &&
      danceClass.activeStudentsCount > room.capacity
    ) {
      conflicts.push({
        type: "capacity",
        assignmentId: assignment.id,
        classId: assignment.class_id,
        message: `${room.name} acima da capacidade.`,
      });
    }

    if (!timeSlots.includes(time)) {
      conflicts.push({
        type: "outside_grid",
        assignmentId: assignment.id,
        classId: assignment.class_id,
        message: "Turma com horário fora da grade.",
      });
    }
  }

  for (const danceClass of classes) {
    if (!danceClass.hasAnySchedule) {
      conflicts.push({
        type: "missing_schedule",
        classId: danceClass.id,
        message: "Turma sem horário cadastrado.",
      });
    }
  }

  for (const sameSlot of roomTime.values()) {
    if (sameSlot.length > 1) {
      conflicts.push({
        type: "room_time",
        assignmentId: sameSlot[0]?.id,
        message: "Duas turmas na mesma sala e horário.",
      });
    }
  }

  for (const sameTeacher of teacherTime.values()) {
    if (sameTeacher.length > 1) {
      conflicts.push({
        type: "teacher_time",
        assignmentId: sameTeacher[0]?.id,
        message: "Mesmo professor em duas turmas no mesmo horário.",
      });
    }
  }

  return conflicts;
}

function sortSchedules(schedules: ScheduleRecord[]) {
  const weekdayOrder = new Map(
    classScheduleWeekdayOptions.map((option, index) => [option.value, index]),
  );

  return [...schedules].sort((first, second) => {
    const weekdayDiff =
      (weekdayOrder.get(first.weekday) ?? 0) -
      (weekdayOrder.get(second.weekday) ?? 0);

    if (weekdayDiff !== 0) {
      return weekdayDiff;
    }

    return first.start_time.localeCompare(second.start_time);
  });
}

function formatSchedules(schedules: ScheduleRecord[]) {
  if (schedules.length === 0) {
    return "Turma sem horário cadastrado.";
  }

  const weekdayLabels = new Map(
    classScheduleWeekdayOptions.map((option) => [option.value, option.label]),
  );

  return schedules
    .map((schedule) => {
      const weekday = weekdayLabels.get(schedule.weekday) ?? schedule.weekday;
      return `${weekday} ${formatScheduleTime(schedule.start_time)}-${formatScheduleTime(schedule.end_time)}`;
    })
    .join(" | ");
}

function buildDefaultTimeSlots() {
  const slots: string[] = [];

  for (let minutes = 9 * 60; minutes < 21 * 60 + 30; minutes += 30) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
}

function timeToMinutes(time: string) {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
