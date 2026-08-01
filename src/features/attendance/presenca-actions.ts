"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/features/auth/session";

export type PresencaActionState = {
  ok?: boolean;
  message?: string;
};

const marcacaoSchema = z.object({
  studentId: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  status: z.enum(["presente", "falta", "justificada"]),
});

const salvarSchema = z.object({
  classId: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  marcacoes: z.array(marcacaoSchema).min(1, "Nenhum aluno para registrar."),
});

/**
 * Grava a chamada de uma turma num dia.
 *
 * Salva a turma inteira de uma vez, não aluno por aluno: o professor marca
 * todo mundo e confirma. Fosse uma ida ao servidor por aluno, uma turma de 20
 * viraria 20 chances de metade gravar.
 *
 * Idempotente por (turma, aluno, dia) — o upsert usa o índice único. Reabrir a
 * chamada e corrigir uma marcação sobrescreve, não duplica.
 *
 * Quem pode gravar é decidido pela RLS (admin/equipe da escola, ou o professor
 * daquela turma), não aqui. Este código usa o cliente com RLS de propósito: se
 * a permissão mudar no banco, ela vale sem precisar lembrar deste arquivo.
 */
export async function salvarChamada(
  entrada: {
    classId: string;
    data: string;
    marcacoes: Array<{
      studentId: string;
      enrollmentId: string;
      status: "presente" | "falta" | "justificada";
    }>;
  },
): Promise<PresencaActionState> {
  const parsed = salvarSchema.safeParse(entrada);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const { classId, data, marcacoes } = parsed.data;
  const user = await getAuthenticatedUser();
  if (!user) {
    return { ok: false, message: "Sessão expirada. Entre novamente." };
  }

  const supabase = await createClient();
  const agora = new Date().toISOString();

  const { error } = await supabase.from("presenca").upsert(
    marcacoes.map((m) => ({
      class_id: classId,
      student_id: m.studentId,
      enrollment_id: m.enrollmentId,
      data,
      status: m.status,
      registrado_por: user.id,
      updated_at: agora,
    })),
    { onConflict: "class_id,student_id,data" },
  );

  if (error) {
    // A mensagem crua do Postgres não ajuda quem está com o celular na mão no
    // meio da aula. A causa quase sempre é uma só.
    console.error("Salvar chamada:", error.message);
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "Você não tem permissão para registrar chamada nesta turma."
          : `Não foi possível salvar: ${error.message}`,
    };
  }

  revalidatePath(`/chamada/${classId}`);
  revalidatePath("/chamada");

  const presentes = marcacoes.filter((m) => m.status === "presente").length;
  return {
    ok: true,
    message: `Chamada salva: ${presentes} de ${marcacoes.length} presentes.`,
  };
}

/**
 * Marca (ou desmarca) um dia como sem aula.
 *
 * Sem isto, feriado vira falta para a turma inteira — e como o alerta conta
 * faltas seguidas, o recesso dispararia alerta para a escola toda.
 */
export async function alternarAulaCancelada(entrada: {
  classId: string;
  data: string;
  motivo?: string;
}): Promise<PresencaActionState> {
  const parsed = z
    .object({
      classId: z.string().uuid(),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      motivo: z.string().trim().max(200).optional(),
    })
    .safeParse(entrada);

  if (!parsed.success) {
    return { ok: false, message: "Dados inválidos." };
  }

  const { classId, data, motivo } = parsed.data;
  const user = await getAuthenticatedUser();
  if (!user) {
    return { ok: false, message: "Sessão expirada. Entre novamente." };
  }

  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("aula_cancelada")
    .select("id")
    .eq("class_id", classId)
    .eq("data", data)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("aula_cancelada")
      .delete()
      .eq("id", existente.id as string);

    if (error) {
      return { ok: false, message: `Não foi possível reabrir o dia: ${error.message}` };
    }

    revalidatePath(`/chamada/${classId}`);
    return { ok: true, message: "Dia reaberto — a aula volta a contar." };
  }

  const { error } = await supabase.from("aula_cancelada").insert({
    class_id: classId,
    data,
    motivo: motivo || null,
    created_by: user.id,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "42501"
          ? "Você não tem permissão para alterar esta turma."
          : `Não foi possível marcar o dia: ${error.message}`,
    };
  }

  revalidatePath(`/chamada/${classId}`);
  return { ok: true, message: "Dia marcado como sem aula." };
}
