import { z } from "zod";

const nullableText = z
  .string()
  .trim()
  .transform((v) => (v.length > 0 ? v : null));

export const espetaculoFormSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do espetáculo."),
  temporada: nullableText,
  data_evento: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v : null))
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable()),
});

export const coreografiaTipoSchema = z.enum([
  "normal",
  "flashmob",
  "flashfinal",
  "especial",
]);

export const coreografiaFormSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da coreografia."),
  musica_texto: nullableText,
  audio_url: nullableText,
  tipo: coreografiaTipoSchema,
  ordem: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? Number(v) : 0))
    .pipe(z.number().int().min(0)),
  duracao_segundos: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? Number(v) : null))
    .pipe(z.number().int().min(0).nullable()),
});

export type CoreografiaTipo = z.infer<typeof coreografiaTipoSchema>;

export const coreografiaTipoOptions: Array<{ value: CoreografiaTipo; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "flashmob", label: "Flashmob" },
  { value: "flashfinal", label: "Flash final" },
  { value: "especial", label: "Especial (elenco manual)" },
];
