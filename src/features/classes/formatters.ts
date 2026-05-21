import {
  classScheduleWeekdayOptions,
  type ClassScheduleFormData,
  type ClassStatus,
} from "@/features/classes/schemas";
import type { ClassSchedule } from "@/features/classes/types";
import { getClassPerformanceStatus } from "@/lib/class-performance";

const weekdayLabels = new Map(
  classScheduleWeekdayOptions.map((option) => [option.value, option.label]),
);

export function formatCapacity(capacity: number | null) {
  return capacity === null ? "-" : String(capacity);
}

export function formatScheduleTime(value: string) {
  return value.slice(0, 5);
}

export function formatClassSchedules(
  schedules: Array<ClassSchedule | ClassScheduleFormData>,
) {
  if (schedules.length === 0) {
    return "-";
  }

  const weekdayOrder = new Map(
    classScheduleWeekdayOptions.map((option, index) => [option.value, index]),
  );

  return [...schedules]
    .sort((a, b) => {
      const weekdayDiff =
        (weekdayOrder.get(a.weekday) ?? 0) - (weekdayOrder.get(b.weekday) ?? 0);

      if (weekdayDiff !== 0) {
        return weekdayDiff;
      }

      return a.start_time.localeCompare(b.start_time);
    })
    .map((schedule) => {
      const weekday = weekdayLabels.get(schedule.weekday) ?? schedule.weekday;
      const room = schedule.room ? ` - ${schedule.room}` : "";

      return `${weekday} ${formatScheduleTime(schedule.start_time)}-${formatScheduleTime(schedule.end_time)}${room}`;
    })
    .join(" | ");
}

export function getClassOperationalStatus({
  status,
  activeEnrollmentsCount,
}: {
  status: ClassStatus;
  capacity: number | null;
  activeEnrollmentsCount: number;
}) {
  if (status === "inactive") {
    return { label: "Inativa", tone: "slate" as const };
  }

  if (status === "planning") {
    return { label: "Em planejamento", tone: "amber" as const };
  }

  const performance = getClassPerformanceStatus(activeEnrollmentsCount);
  const toneByPerformance = {
    danger: "rose",
    warning: "amber",
    success: "emerald",
    premium: "violet",
  } as const;

  return {
    label: performance.label,
    tone: toneByPerformance[performance.tone],
  };
}
