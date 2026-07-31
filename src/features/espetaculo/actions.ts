"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/features/auth/session";
import {
  coreografiaFormSchema,
  espetaculoFormSchema,
} from "@/features/espetaculo/schemas";

export type EspetaculoActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

// ---------------- Espetáculo ----------------
export async function createEspetaculo(
  _prev: EspetaculoActionState,
  formData: FormData,
): Promise<EspetaculoActionState> {
  const parsed = espetaculoFormSchema.safeParse({
    nome: String(formData.get("nome") ?? ""),
    temporada: String(formData.get("temporada") ?? ""),
    data_evento: String(formData.get("data_evento") ?? ""),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, message: "Revise os campos." };
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  const { data, error } = await supabase
    .from("espetaculo")
    .insert({ ...parsed.data, created_by: user?.id ?? null })
    .select("id")
    .single();

  if (error || !data) {
    return { message: error?.message ?? "Não foi possível criar o espetáculo." };
  }

  revalidatePath("/espetaculos");
  redirect(`/espetaculos/${data.id}`);
}

export async function deleteEspetaculo(espetaculoId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("espetaculo").delete().eq("id", espetaculoId);
  revalidatePath("/espetaculos");
  redirect("/espetaculos");
}

// ---------------- Coreografia ----------------
export async function createCoreografia(
  espetaculoId: string,
  _prev: EspetaculoActionState,
  formData: FormData,
): Promise<EspetaculoActionState> {
  const parsed = coreografiaFormSchema.safeParse({
    nome: String(formData.get("nome") ?? ""),
    musica_texto: String(formData.get("musica_texto") ?? ""),
    audio_url: String(formData.get("audio_url") ?? ""),
    tipo: String(formData.get("tipo") ?? "normal"),
    ordem: String(formData.get("ordem") ?? "0"),
    duracao_segundos: String(formData.get("duracao_segundos") ?? ""),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, message: "Revise os campos." };
  }

  const turmaIds = formData.getAll("turma_ids").map(String).filter(Boolean);
  const professorIds = formData.getAll("professor_ids").map(String).filter(Boolean);
  const alunoIds = formData.getAll("aluno_ids").map(String).filter(Boolean);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coreografia")
    .insert({ espetaculo_id: espetaculoId, ...parsed.data })
    .select("id")
    .single();

  if (error || !data) {
    return { message: error?.message ?? "Não foi possível criar a coreografia." };
  }

  const coreografiaId = data.id as string;
  if (turmaIds.length > 0) {
    await supabase
      .from("coreografia_turma")
      .insert(turmaIds.map((turma_id) => ({ coreografia_id: coreografiaId, turma_id })));
  }
  if (professorIds.length > 0) {
    await supabase
      .from("coreografia_professor")
      .insert(professorIds.map((professor_id) => ({ coreografia_id: coreografiaId, professor_id })));
  }
  if (parsed.data.tipo === "especial" && alunoIds.length > 0) {
    await supabase
      .from("coreografia_aluno")
      .insert(alunoIds.map((aluno_id) => ({ coreografia_id: coreografiaId, aluno_id })));
  }

  revalidatePath(`/espetaculos/${espetaculoId}`);
  return { message: "Coreografia criada." };
}

export async function updateCoreografia(
  espetaculoId: string,
  coreografiaId: string,
  _prev: EspetaculoActionState,
  formData: FormData,
): Promise<EspetaculoActionState> {
  const parsed = coreografiaFormSchema.safeParse({
    nome: String(formData.get("nome") ?? ""),
    musica_texto: String(formData.get("musica_texto") ?? ""),
    audio_url: String(formData.get("audio_url") ?? ""),
    tipo: String(formData.get("tipo") ?? "normal"),
    ordem: String(formData.get("ordem") ?? "0"),
    duracao_segundos: String(formData.get("duracao_segundos") ?? ""),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, message: "Revise os campos." };
  }

  const turmaIds = formData.getAll("turma_ids").map(String).filter(Boolean);
  const professorIds = formData.getAll("professor_ids").map(String).filter(Boolean);
  const alunoIds = formData.getAll("aluno_ids").map(String).filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase
    .from("coreografia")
    .update(parsed.data)
    .eq("id", coreografiaId);
  if (error) {
    return { message: error.message ?? "Não foi possível atualizar a coreografia." };
  }

  // Re-sincroniza os vínculos (apaga os atuais e insere a nova seleção).
  await supabase.from("coreografia_turma").delete().eq("coreografia_id", coreografiaId);
  if (turmaIds.length > 0) {
    await supabase
      .from("coreografia_turma")
      .insert(turmaIds.map((turma_id) => ({ coreografia_id: coreografiaId, turma_id })));
  }

  await supabase.from("coreografia_professor").delete().eq("coreografia_id", coreografiaId);
  if (professorIds.length > 0) {
    await supabase
      .from("coreografia_professor")
      .insert(professorIds.map((professor_id) => ({ coreografia_id: coreografiaId, professor_id })));
  }

  await supabase.from("coreografia_aluno").delete().eq("coreografia_id", coreografiaId);
  if (parsed.data.tipo === "especial" && alunoIds.length > 0) {
    await supabase
      .from("coreografia_aluno")
      .insert(alunoIds.map((aluno_id) => ({ coreografia_id: coreografiaId, aluno_id })));
  }

  revalidatePath(`/espetaculos/${espetaculoId}`);
  return { message: "Coreografia atualizada." };
}

export async function deleteCoreografia(
  espetaculoId: string,
  coreografiaId: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("coreografia").delete().eq("id", coreografiaId);
  revalidatePath(`/espetaculos/${espetaculoId}`);
}
