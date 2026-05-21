import { z } from "zod";

export const classStatusSchema = z.enum(["active", "inactive", "planning"]);

export const classScheduleWeekdaySchema = z.enum([
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
]);

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const requiredText = (message: string) => z.string().trim().min(1, message);
const requiredUuid = (message: string) => z.string().uuid(message);

const requiredCapacity = z
  .string()
  .trim()
  .min(1, "Informe a capacidade.")
  .transform((value) => Number(value))
  .pipe(
    z
      .number()
      .int("Informe um número inteiro.")
      .positive("A capacidade deve ser maior que zero."),
  );

const requiredTime = z
  .string()
  .trim()
  .min(1, "Informe o horário.")
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.");

export const classScheduleFormSchema = z
  .object({
    weekday: classScheduleWeekdaySchema,
    start_time: requiredTime,
    end_time: requiredTime,
    room: nullableText,
  })
  .refine((data) => data.end_time > data.start_time, {
    path: ["end_time"],
    message: "O horário final deve ser depois do horário inicial.",
  });

export const classFormSchema = z.object({
  name: requiredText("Informe o nome da turma."),
  teacher_id: z.string().uuid("Selecione um professor."),
  modality_id: requiredUuid("Selecione uma modalidade."),
  level_id: requiredUuid("Selecione um nível."),
  capacity: requiredCapacity,
  notes: nullableText,
  schedules: z
    .array(classScheduleFormSchema)
    .min(1, "Cadastre pelo menos um horário."),
});

export const classCreateFormSchema = classFormSchema.omit({ name: true }).extend({
  name: z.string().trim().optional(),
});

export type ClassFormData = z.infer<typeof classFormSchema>;
export type ClassCreateFormData = z.infer<typeof classCreateFormSchema>;
export type ClassScheduleFormData = z.infer<typeof classScheduleFormSchema>;
export type ClassStatus = z.infer<typeof classStatusSchema>;
export type ClassScheduleWeekday = z.infer<typeof classScheduleWeekdaySchema>;

export const classScheduleWeekdayOptions: Array<{
  value: ClassScheduleWeekday;
  label: string;
}> = [
  { value: "segunda", label: "Segunda" },
  { value: "terca", label: "Terça" },
  { value: "quarta", label: "Quarta" },
  { value: "quinta", label: "Quinta" },
  { value: "sexta", label: "Sexta" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" },
];

export function getAutomaticClassStatus(data: ClassFormData): ClassStatus {
  return data.schedules.length > 0 ? "active" : "planning";
}
