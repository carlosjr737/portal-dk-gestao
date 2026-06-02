import type { ClassScheduleWeekday } from "@/features/classes/schemas";

export type RoomRotationDayGroup = "SEG_QUA" | "TER_QUI" | "SEX" | "SAB";
export type RoomRotationStatus = "draft" | "published" | "archived";

export type Room = {
  id: string;
  name: string;
  slug: string | null;
  capacity: number | null;
  color: string | null;
  sort_order: number;
  active: boolean;
};

export type RoomRotationPlan = {
  id: string;
  name: string;
  year: number;
  month: number;
  day_group: RoomRotationDayGroup;
  rotation_label: string;
  status: RoomRotationStatus;
  notes: string | null;
};

export type RoomRotationAssignment = {
  id: string;
  rotation_plan_id: string;
  class_id: string;
  room_id: string;
  start_time: string;
  end_time: string | null;
  day_group: RoomRotationDayGroup;
  sort_order: number;
  notes: string | null;
};

export type RoomRotationClassCard = {
  id: string;
  name: string;
  teacherName: string;
  modalityName: string;
  levelName: string;
  schedules: Array<{
    weekday: ClassScheduleWeekday;
    start_time: string;
    end_time: string;
    room: string | null;
  }>;
  schedulesLabel: string;
  primaryStartTime: string | null;
  primaryEndTime: string | null;
  activeStudentsCount: number;
  status: string;
  hasMatchingSchedule: boolean;
  hasAnySchedule: boolean;
};

export type RoomRotationConflict = {
  type:
    | "room_time"
    | "teacher_time"
    | "missing_room"
    | "capacity"
    | "missing_schedule"
    | "outside_grid";
  message: string;
  classId?: string;
  assignmentId?: string;
};

export type RoomRotationPageData = {
  rooms: Room[];
  plans: RoomRotationPlan[];
  selectedPlan: RoomRotationPlan | null;
  assignments: RoomRotationAssignment[];
  classes: RoomRotationClassCard[];
  timeSlots: string[];
  conflicts: RoomRotationConflict[];
};
