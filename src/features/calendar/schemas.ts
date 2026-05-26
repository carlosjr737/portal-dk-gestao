import { z } from "zod";
import type { CalendarEventType } from "@/features/calendar/types";

export const calendarEventTypes: Array<{
  value: CalendarEventType;
  label: string;
}> = [
  { value: "feriado", label: "Feriado" },
  { value: "recesso", label: "Recesso" },
  { value: "evento", label: "Evento" },
  { value: "ensaio", label: "Ensaio" },
  { value: "espetaculo", label: "Espetáculo" },
  { value: "aula_suspensa", label: "Aula suspensa" },
  { value: "reposicao", label: "Reposição" },
  { value: "outro", label: "Outro" },
];

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .pipe(z.string().uuid().nullable());

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const optionalTime = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .pipe(
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.")
      .nullable(),
  );

export const calendarEventFormSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título."),
    description: optionalText,
    event_type: z.enum([
      "feriado",
      "recesso",
      "evento",
      "ensaio",
      "espetaculo",
      "aula_suspensa",
      "reposicao",
      "outro",
    ]),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data inicial."),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data final."),
    all_day: z.boolean(),
    start_time: optionalTime,
    end_time: optionalTime,
    affects_classes: z.boolean(),
    affects_all_classes: z.boolean(),
    class_id: optionalUuid,
    teacher_id: optionalUuid,
    modality_id: optionalUuid,
    level_id: optionalUuid,
  })
  .refine((data) => data.end_date >= data.start_date, {
    path: ["end_date"],
    message: "A data final não pode ser menor que a inicial.",
  })
  .refine(
    (data) =>
      data.all_day ||
      !data.start_time ||
      !data.end_time ||
      data.end_time > data.start_time,
    {
      path: ["end_time"],
      message: "O horário final deve ser depois do inicial.",
    },
  )
  .transform((data) => ({
    ...data,
    start_time: data.all_day ? null : data.start_time,
    end_time: data.all_day ? null : data.end_time,
    affects_all_classes: data.affects_classes ? data.affects_all_classes : false,
    class_id:
      data.affects_classes && !data.affects_all_classes ? data.class_id : null,
    teacher_id:
      data.affects_classes && !data.affects_all_classes ? data.teacher_id : null,
    modality_id:
      data.affects_classes && !data.affects_all_classes ? data.modality_id : null,
    level_id:
      data.affects_classes && !data.affects_all_classes ? data.level_id : null,
  }));

export type CalendarEventFormData = z.infer<typeof calendarEventFormSchema>;
