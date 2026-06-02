import type { ClassScheduleWeekday } from "@/features/classes/schemas";
import type { RoomRotationDayGroup } from "@/features/room-rotation/types";

export const roomRotationDayGroupOptions: Array<{
  value: RoomRotationDayGroup;
  label: string;
}> = [
  { value: "SEG_QUA", label: "SEG/QUA" },
  { value: "TER_QUI", label: "TER/QUI" },
  { value: "SEX", label: "SEX" },
  { value: "SAB", label: "SAB" },
];

export const roomRotationLabels = [
  "Rodízio 1",
  "Rodízio 2",
  "Rodízio 3",
  "Rodízio 4",
  "Rodízio 5",
] as const;

export const dayGroupWeekdays: Record<
  RoomRotationDayGroup,
  ClassScheduleWeekday[]
> = {
  SEG_QUA: ["segunda", "quarta"],
  TER_QUI: ["terca", "quinta"],
  SEX: ["sexta"],
  SAB: ["sabado"],
};

export function getRoomRotationDayGroupLabel(dayGroup: RoomRotationDayGroup) {
  return (
    roomRotationDayGroupOptions.find((option) => option.value === dayGroup)
      ?.label ?? dayGroup
  );
}

export function formatRotationMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}
