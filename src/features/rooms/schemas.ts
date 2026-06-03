import { z } from "zod";

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const optionalInteger = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? Number(value) : null))
  .pipe(z.number().int("Informe um número inteiro.").positive("Informe um valor positivo.").nullable());

const sortOrder = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? Number(value) : 0))
  .pipe(z.number().int("Informe um número inteiro."));

export const roomFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da sala."),
  slug: z
    .string()
    .trim()
    .min(1, "Informe o slug.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens."),
  capacity: optionalInteger,
  color: nullableText,
  sort_order: sortOrder,
  active: z.boolean(),
});

export type RoomFormData = z.infer<typeof roomFormSchema>;
