"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/features/auth/session";

export type PersonagemActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

const camposComuns = {
  nome: z.string().trim().min(1, "Informe o nome do personagem."),
  cor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use hex, ex.: #8b5cf6)."),
  aluno_id: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v : null))
    .pipe(z.string().uuid("Aluno inválido.").nullable()),
};

const personagemSchema = z.object(camposComuns);
const createSchema = z.object({
  ...camposComuns,
  espetaculo_id: z.string().uuid("Espetáculo inválido."),
});

function parse(formData: FormData) {
  return personagemSchema.safeParse({
    nome: String(formData.get("nome") ?? ""),
    cor: String(formData.get("cor") ?? "#8b5cf6"),
    aluno_id: String(formData.get("aluno_id") ?? ""),
  });
}

export async function createPersonagem(
  _prev: PersonagemActionState,
  formData: FormData,
): Promise<PersonagemActionState> {
  const parsed = createSchema.safeParse({
    espetaculo_id: String(formData.get("espetaculo_id") ?? ""),
    nome: String(formData.get("nome") ?? ""),
    cor: String(formData.get("cor") ?? "#8b5cf6"),
    aluno_id: String(formData.get("aluno_id") ?? ""),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, message: "Revise os campos." };
  }
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  const { error } = await supabase
    .from("personagem")
    .insert({ ...parsed.data, created_by: user?.id ?? null });
  if (error) {
    return { message: `Não foi possível criar o personagem: ${error.message}` };
  }
  revalidatePath(`/espetaculos/${parsed.data.espetaculo_id}`);
  return { message: "Personagem criado." };
}

export async function updatePersonagem(
  personagemId: string,
  _prev: PersonagemActionState,
  formData: FormData,
): Promise<PersonagemActionState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, message: "Revise os campos." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("personagem")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", personagemId);
  if (error) {
    return { message: `Não foi possível atualizar: ${error.message}` };
  }
  const espetaculoId = String(formData.get("espetaculo_id") ?? "");
  if (espetaculoId) revalidatePath(`/espetaculos/${espetaculoId}`);
  return { message: "Personagem atualizado." };
}

export async function deletePersonagem(
  personagemId: string,
  espetaculoId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("personagem").delete().eq("id", personagemId);
  if (espetaculoId) revalidatePath(`/espetaculos/${espetaculoId}`);
}
