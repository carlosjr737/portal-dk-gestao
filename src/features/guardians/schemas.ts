import { z } from "zod";

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const nullableEmail = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .pipe(z.email().nullable());

export const guardianFormSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome completo."),
  document: nullableText,
  phone: nullableText,
  email: nullableEmail,
  notes: nullableText,
});

export const guardianRelationshipSchema = z.enum([
  "financial",
  "pedagogical",
  "emergency",
]);

export const linkGuardianToStudentSchema = z.object({
  student_id: z.string().uuid("Selecione um aluno válido."),
  relationship_type: guardianRelationshipSchema,
  is_primary: z.boolean(),
});

export type GuardianFormData = z.infer<typeof guardianFormSchema>;
export type GuardianRelationship = z.infer<typeof guardianRelationshipSchema>;

export const guardianRelationshipOptions: Array<{
  value: GuardianRelationship;
  label: string;
}> = [
  { value: "financial", label: "Financeiro" },
  { value: "pedagogical", label: "Pedagógico" },
  { value: "emergency", label: "Emergência" },
];
