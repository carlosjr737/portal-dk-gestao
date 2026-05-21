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

export const staffRoleSchema = z.enum([
  "professor",
  "coordenador",
  "financeiro",
  "secretaria",
  "admin",
]);

export const staffStatusSchema = z.enum(["active", "inactive"]);

export const staffMemberFormSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome completo."),
  artistic_name: nullableText,
  email: nullableEmail,
  phone: nullableText,
  role: staffRoleSchema,
  status: staffStatusSchema,
});

export type StaffRole = z.infer<typeof staffRoleSchema>;
export type StaffStatus = z.infer<typeof staffStatusSchema>;
export type StaffMemberFormData = z.infer<typeof staffMemberFormSchema>;

export const staffRoleOptions: Array<{ value: StaffRole; label: string }> = [
  { value: "professor", label: "Professor" },
  { value: "coordenador", label: "Coordenador" },
  { value: "financeiro", label: "Financeiro" },
  { value: "secretaria", label: "Secretaria" },
  { value: "admin", label: "Admin" },
];

export const staffStatusOptions: Array<{ value: StaffStatus; label: string }> = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
];
