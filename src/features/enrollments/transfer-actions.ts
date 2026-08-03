"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/features/auth/session";
import { garantirCobrancaDaMatricula } from "@/features/baas/cobranca-automatica";

export type TransferResult = { ok: true; message: string } | { ok: false; message: string };

const schema = z.object({
  enrollmentId: z.string().uuid(),
  novaTurmaId: z.string().uuid(),
  motivo: z.string().trim().max(300).optional(),
});

/**
 * Troca o aluno de turma sem cancelar a matrícula.
 *
 * POR QUE NÃO É "CANCELAR E CRIAR OUTRA"
 * Cancelar registra uma SAÍDA no log de churn, e o aluno não saiu da escola —
 * mudou de horário. Um ano de trocas de turma apareceria como evasão, e a
 * taxa de churn, que existe justamente para achar quem está indo embora,
 * apontaria para quem ficou.
 *
 * Além disso o cancelamento derruba o item do contrato e a cobrança
 * recorrente, e criar outra matrícula geraria uma assinatura nova no Asaas —
 * a família receberia duas cobranças no mês da troca.
 *
 * O QUE A TROCA PRESERVA
 * A matrícula é a mesma linha: mantém id, data de início, responsável
 * financeiro, valor, desconto e o item de contrato. Só o `class_id` muda.
 *
 * O QUE ELA NÃO MUDA, DE PROPÓSITO
 * O valor da mensalidade. Turma nova pode ter preço diferente, mas isso é
 * decisão comercial de quem faz a troca — mudar sozinho alteraria a cobrança
 * da família sem ninguém pedir. Se o valor tiver que mudar, muda depois, na
 * edição da matrícula, e aí a cobrança acompanha.
 *
 * A PRESENÇA JÁ REGISTRADA FICA NA TURMA ANTIGA
 * Ela é fato: o aluno esteve lá naquele dia. Mover a chamada junto reescreve
 * o passado e some com a frequência de quem realmente deu a aula.
 */
export async function transferirMatricula(entrada: {
  enrollmentId: string;
  novaTurmaId: string;
  motivo?: string;
}): Promise<TransferResult> {
  const parsed = schema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, message: "Dados inválidos para a troca de turma." };
  }
  const { enrollmentId, novaTurmaId, motivo } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: "Sessão expirada. Entre novamente." };

  const supabase = await createClient();

  const { data: matricula, error: erroMatricula } = await supabase
    .from("enrollments")
    .select("id, student_id, class_id, status, escola_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (erroMatricula || !matricula) {
    return { ok: false, message: "Matrícula não encontrada." };
  }
  if (matricula.status !== "active") {
    return {
      ok: false,
      message: "Só matrícula ativa pode trocar de turma. Esta está cancelada.",
    };
  }
  if (matricula.class_id === novaTurmaId) {
    return { ok: false, message: "O aluno já está nesta turma." };
  }

  const { data: novaTurma } = await supabase
    .from("classes")
    .select("id, name, status, capacity")
    .eq("id", novaTurmaId)
    .maybeSingle();

  if (!novaTurma) return { ok: false, message: "Turma de destino não encontrada." };
  if (novaTurma.status !== "active") {
    return { ok: false, message: "A turma de destino não está ativa." };
  }

  /*
   * Capacidade: avisa, mas não impede. Secretaria sabe de exceção que o
   * sistema não sabe — aluno que vai por duas semanas, irmão que acompanha.
   * Bloquear aqui faria a pessoa cancelar e recriar por fora, que é
   * exatamente o que esta função existe para evitar.
   */
  const { count: ocupacao } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", novaTurmaId)
    .eq("status", "active");

  const capacidade = novaTurma.capacity as number | null;
  const lotada = capacidade !== null && (ocupacao ?? 0) >= capacidade;

  const { data: turmaAntiga } = await supabase
    .from("classes")
    .select("name")
    .eq("id", matricula.class_id as string)
    .maybeSingle();

  const { error: erroUpdate } = await supabase
    .from("enrollments")
    .update({ class_id: novaTurmaId })
    .eq("id", enrollmentId);

  if (erroUpdate) {
    return {
      ok: false,
      message:
        erroUpdate.code === "42501"
          ? "Você não tem permissão para trocar a turma desta matrícula."
          : `Não foi possível trocar de turma: ${erroUpdate.message}`,
    };
  }

  /*
   * O histórico é o que responde "por que este aluno está em outra turma?"
   * seis meses depois. Sem ele a troca é indistinguível de um erro de
   * cadastro — e a mesma tabela já guarda os cancelamentos, então o
   * histórico da matrícula fica inteiro num lugar só.
   *
   * Falhar aqui não desfaz a troca: a troca é o fato, o registro é o
   * comentário. Perder o comentário é ruim; desfazer o fato é pior.
   */
  const { error: erroLog } = await supabase.from("enrollment_logs").insert({
    enrollment_id: enrollmentId,
    student_id: matricula.student_id,
    class_id: novaTurmaId,
    /*
     * `class_changed` e não um nome novo: o check de `enrollment_logs` já
     * previa este evento desde antes desta função existir. Inventar
     * 'enrollment_transferred' seria rejeitado pelo banco — e como o erro do
     * log só vai para o console, a troca funcionaria e o histórico sumiria
     * sem ninguém notar.
     */
    event_type: "class_changed",
    reason: motivo || null,
    notes: `De "${turmaAntiga?.name ?? "turma anterior"}" para "${novaTurma.name}".`,
    previous_status: "active",
    new_status: "active",
    created_by: user.id,
  });

  if (erroLog) {
    console.error("Troca de turma — log:", erroLog.message);
  }

  /*
   * A cobrança é reavaliada mesmo sem mudança de valor: a função é
   * idempotente e, se nada mudou, não faz nada. Chamar sempre é mais barato
   * que descobrir depois que um caso de borda ficou sem sincronizar.
   */
  await garantirCobrancaDaMatricula(enrollmentId);

  revalidatePath("/matriculas");
  revalidatePath(`/alunos/${matricula.student_id}`);
  revalidatePath(`/turmas/${matricula.class_id}`);
  revalidatePath(`/turmas/${novaTurmaId}`);
  revalidatePath("/chamada");

  return {
    ok: true,
    message: lotada
      ? `Aluno movido para ${novaTurma.name}. Atenção: a turma passou da capacidade (${(ocupacao ?? 0) + 1} de ${capacidade}).`
      : `Aluno movido para ${novaTurma.name}.`,
  };
}
