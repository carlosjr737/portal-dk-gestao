export type CalendarEventType =
  | "feriado"
  | "recesso"
  | "evento"
  | "ensaio"
  | "espetaculo"
  | "aula_suspensa"
  | "reposicao"
  | "outro";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: CalendarEventType;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  affects_classes: boolean;
  affects_all_classes: boolean;
  class_id: string | null;
  teacher_id: string | null;
  modality_id: string | null;
  level_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarSelectOption = {
  id: string;
  name: string;
};

export type CalendarEventFormOptions = {
  classes: CalendarSelectOption[];
  teachers: CalendarSelectOption[];
  modalities: CalendarSelectOption[];
  levels: CalendarSelectOption[];
};
