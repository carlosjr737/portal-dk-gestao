import type {
  ClassScheduleWeekday,
  ClassStatus,
} from "@/features/classes/schemas";
import type { TeacherOption } from "@/features/staff/types";
import type { CatalogOption } from "@/features/class-catalog/types";

export type ClassSchedule = {
  id: string;
  class_id: string;
  weekday: ClassScheduleWeekday;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at: string;
  updated_at: string;
};

export type DanceClass = {
  id: string;
  name: string;
  category: string | null;
  modality_id: string | null;
  level_id: string | null;
  teacher_id: string | null;
  instructor_name: string | null;
  schedule_description: string | null;
  capacity: number | null;
  status: ClassStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DanceClassWithActiveEnrollments = DanceClass & {
  active_enrollments_count: number;
  total_enrollments_count: number;
  schedules: ClassSchedule[];
  teacher: TeacherOption | null;
  modality: CatalogOption | null;
  levelOption: CatalogOption | null;
};
