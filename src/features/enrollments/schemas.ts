import { z } from "zod";

export const enrollmentStatusSchema = z.enum([
  "active",
  "cancelled",
  "paused",
  "ended",
  "evaluation",
]);

const nullableUuid = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .pipe(z.string().uuid().nullable());

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const requiredDate = (message: string) =>
  z.string().trim().min(1, message).regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

const optionalMoneyValue = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? Number(value) : null))
  .pipe(
    z
      .number()
      .nonnegative("Informe um valor maior ou igual a zero.")
      .nullable(),
  );

const requiredPositiveMoneyValue = z
  .string()
  .trim()
  .min(1, "Informe o valor mensal.")
  .transform((value) => Number(value))
  .pipe(z.number().positive("Informe um valor mensal maior que zero."));

export const enrollmentFormSchema = z
  .object({
    student_id: z.string().uuid("Selecione um aluno."),
    class_id: z.string().uuid("Selecione uma turma."),
    start_date: requiredDate("Informe a data de início."),
    end_date: requiredDate("Informe a data final."),
    first_due_date: nullableText.pipe(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
        .nullable(),
    ),
    status: enrollmentStatusSchema,
    financial_guardian_id: nullableUuid,
    monthly_amount: requiredPositiveMoneyValue,
    discount_amount: optionalMoneyValue,
    discount_reason: nullableText,
    notes: nullableText,
  })
  .refine((data) => data.end_date >= data.start_date, {
    path: ["end_date"],
    message: "A data final deve ser maior ou igual à data de início.",
  });

export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;
export type EnrollmentFormData = z.infer<typeof enrollmentFormSchema>;

export const enrollmentCancellationReasons = [
  "Mudança de horário",
  "Mudança de modalidade",
  "Mudança de turma",
  "Questão financeira",
  "Falta de adaptação",
  "Falta de interesse do aluno",
  "Incompatibilidade com agenda da família",
  "Mudança de cidade/endereço",
  "Questão de saúde",
  "Pausa temporária",
  "Insatisfação com a aula",
  "Insatisfação com atendimento",
  "Encerramento de contrato",
  "Outro",
] as const;

export const enrollmentCancellationReasonSchema = z.enum(
  enrollmentCancellationReasons,
);

export type EnrollmentCancellationReason = z.infer<
  typeof enrollmentCancellationReasonSchema
>;

export const enrollmentStatusOptions: Array<{
  value: EnrollmentStatus;
  label: string;
}> = [
  { value: "active", label: "Ativa" },
  { value: "paused", label: "Pausada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "ended", label: "Encerrada" },
  { value: "evaluation", label: "Em avaliação" },
];
