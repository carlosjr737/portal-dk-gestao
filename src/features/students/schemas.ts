import { z } from "zod";

export const studentStatusSchema = z.enum(["active", "inactive", "evaluation"]);

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const nullableEmail = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .pipe(z.email().nullable());

const nullableDate = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .pipe(z.iso.date().nullable());

export const studentFormSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome completo."),
  display_name: nullableText,
  birth_date: nullableDate,
  document: nullableText,
  phone: nullableText,
  email: nullableEmail,
  status: studentStatusSchema,
  notes: nullableText,
});

export type StudentFormData = z.infer<typeof studentFormSchema>;
export type StudentStatus = z.infer<typeof studentStatusSchema>;

export const studentStatusOptions: Array<{
  value: StudentStatus;
  label: string;
}> = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "evaluation", label: "Em avaliação" },
];
