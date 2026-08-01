"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";

export type SchoolActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  ok?: boolean;
};

const opcional = z
  .string()
  .trim()
  .transform((v) => (v.length > 0 ? v : null));

const schoolSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da escola."),
  razao_social: opcional,
  cnpj: opcional,
  email: opcional,
  telefone: opcional,
  cep: opcional,
  logradouro: opcional,
  numero: opcional,
  complemento: opcional,
  bairro: opcional,
  cidade: opcional,
  uf: opcional,
});

const CAMPOS = [
  "nome",
  "razao_social",
  "cnpj",
  "email",
  "telefone",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
] as const;

/**
 * Atualiza os dados da PRÓPRIA escola. A RLS já restringe a linha
 * (`id = current_escola()` e papel admin); o filtro aqui é defesa em
 * profundidade, não a única barreira.
 */
export async function updateSchool(
  _prev: SchoolActionState,
  formData: FormData,
): Promise<SchoolActionState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Apenas admin pode editar os dados da escola." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) {
    return { ok: false, message: "Seu usuário não está vinculado a uma escola." };
  }

  const parsed = schoolSchema.safeParse(
    Object.fromEntries(CAMPOS.map((c) => [c, String(formData.get(c) ?? "")])),
  );

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("school")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", escolaId);

  if (error) {
    return { ok: false, message: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/configuracoes/escola");
  return { ok: true, message: "Dados da escola atualizados." };
}
