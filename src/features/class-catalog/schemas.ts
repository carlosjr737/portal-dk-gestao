import { z } from "zod";

export const catalogStatusSchema = z.enum(["active", "inactive"]);

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const sortOrder = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? Number(value) : 0))
  .pipe(z.number().int("Informe um número inteiro."));

export const catalogItemFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  description: nullableText,
  status: catalogStatusSchema,
  sort_order: sortOrder,
});

export type CatalogItemFormData = z.infer<typeof catalogItemFormSchema>;
export type CatalogStatus = z.infer<typeof catalogStatusSchema>;

export const catalogStatusOptions: Array<{
  value: CatalogStatus;
  label: string;
}> = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
];
