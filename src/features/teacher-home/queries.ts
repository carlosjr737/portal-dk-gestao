import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O painel do professor — só o que é dele.
 *
 * ┌─ NENHUM NÚMERO DE DINHEIRO AQUI, E É DE PROPÓSITO ──────────────────┐
 * │ A escola tirou o Dashboard do professor justamente porque lá tem    │
 * │ faturamento. Repetir receita nesta tela recriaria o problema com    │
 * │ outro nome. O que o professor precisa é o dia dele: quais turmas,   │
 * │ quantos alunos, quanto tempo em aula e como foi avaliado.           │
 * │                                                                     │
 * │ Quanto ele GANHA é assunto dele e existe — mas é a tela de          │
 * │ pagamento, com vigência e fechamento, não um cartão solto.          │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * O vínculo entre a conta e o cadastro de professor é o E-MAIL. Não é ideal
 * — um typo desliga a pessoa do próprio histórico — mas é o que existe hoje,
 * e inventar uma coluna nova aqui esconderia essa fragilidade em vez de
 * resolvê-la. Quando não casa, a tela diz isso em vez de mostrar zero.
 */

export type TurmaDoProfessor = {
  id: string;
  nome: string;
  modalidade: string | null;
  nivel: string | null;
  alunos: number;
  capacidade: number;
  horarios: string[];
};

export type PainelProfessor = {
  /** Falso quando o e-mail da conta não bate com nenhum cadastro. */
  vinculado: boolean;
  nome: string | null;
  turmas: TurmaDoProfessor[];
  totalAlunos: number;
  /** Horas de aula por semana, somando os horários cadastrados. */
  horasSemanais: number;
  dna: { media: number; avaliacoes: number } | null;
};

const VAZIO: PainelProfessor = {
  vinculado: false,
  nome: null,
  turmas: [],
  totalAlunos: 0,
  horasSemanais: 0,
  dna: null,
};

/** "18:30" e "20:00" viram 1.5 hora. */
function horasEntre(inicio: string | null, fim: string | null): number {
  if (!inicio || !fim) return 0;
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  if ([hi, mi, hf, mf].some(Number.isNaN)) return 0;
  const minutos = hf * 60 + mf - (hi * 60 + mi);
  return minutos > 0 ? minutos / 60 : 0;
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export async function getPainelProfessor(
  email: string | null,
  escolaId: string | null,
): Promise<PainelProfessor> {
  if (!email || !escolaId) return VAZIO;

  const admin = createAdminClient();

  const { data: staff } = await admin
    .from("staff_members")
    .select("id, full_name, artistic_name")
    .eq("escola_id", escolaId)
    .ilike("email", email)
    .maybeSingle();

  if (!staff) return VAZIO;

  const staffId = staff.id as string;
  const nome =
    ((staff.artistic_name as string | null)?.trim() ||
      (staff.full_name as string | null)) ??
    null;

  const { data: turmas } = await admin
    .from("classes")
    .select("id, name, capacity, modality_id, level_id")
    .eq("escola_id", escolaId)
    .eq("teacher_id", staffId)
    .eq("status", "active");

  const ids = (turmas ?? []).map((t) => t.id as string);

  if (ids.length === 0) {
    return { ...VAZIO, vinculado: true, nome };
  }

  const [matriculasRes, horariosRes, modalidadesRes, niveisRes, dnaRes] =
    await Promise.all([
      admin
        .from("enrollments")
        .select("class_id, student_id")
        .eq("escola_id", escolaId)
        .eq("status", "active")
        .in("class_id", ids),
      admin
        .from("class_schedules")
        .select("class_id, weekday, start_time, end_time")
        .eq("escola_id", escolaId)
        .in("class_id", ids),
      admin.from("modalities").select("id, name").eq("escola_id", escolaId),
      admin.from("levels").select("id, name").eq("escola_id", escolaId),
      admin
        .from("teacher_dna_assessments")
        .select("overall_score")
        .eq("escola_id", escolaId)
        .eq("teacher_id", staffId)
        .not("overall_score", "is", null),
    ]);

  const nomeModalidade = new Map(
    (modalidadesRes.data ?? []).map((m) => [m.id as string, m.name as string]),
  );
  const nomeNivel = new Map(
    (niveisRes.data ?? []).map((n) => [n.id as string, n.name as string]),
  );

  const alunosPorTurma = new Map<string, Set<string>>();
  for (const m of matriculasRes.data ?? []) {
    const turma = m.class_id as string;
    if (!alunosPorTurma.has(turma)) alunosPorTurma.set(turma, new Set());
    const aluno = m.student_id as string | null;
    if (aluno) alunosPorTurma.get(turma)!.add(aluno);
  }

  const horariosPorTurma = new Map<string, string[]>();
  let horasSemanais = 0;
  for (const h of horariosRes.data ?? []) {
    const turma = h.class_id as string;
    const inicio = (h.start_time as string | null)?.slice(0, 5) ?? null;
    const fim = (h.end_time as string | null)?.slice(0, 5) ?? null;
    const dia = DIAS[Number(h.weekday ?? -1)] ?? "";
    horasSemanais += horasEntre(inicio, fim);
    if (inicio) {
      horariosPorTurma.set(turma, [
        ...(horariosPorTurma.get(turma) ?? []),
        `${dia} ${inicio}${fim ? `–${fim}` : ""}`.trim(),
      ]);
    }
  }

  const notas = (dnaRes.data ?? []).map((d) => Number(d.overall_score ?? 0));

  // Alunos distintos no total: quem faz duas turmas dele não conta duas vezes.
  const distintos = new Set<string>();
  for (const conjunto of alunosPorTurma.values()) {
    for (const a of conjunto) distintos.add(a);
  }

  return {
    vinculado: true,
    nome,
    turmas: (turmas ?? [])
      .map((t) => ({
        id: t.id as string,
        nome: (t.name as string) ?? "Sem nome",
        modalidade: nomeModalidade.get(t.modality_id as string) ?? null,
        nivel: nomeNivel.get(t.level_id as string) ?? null,
        alunos: alunosPorTurma.get(t.id as string)?.size ?? 0,
        capacidade: Number(t.capacity ?? 0),
        horarios: horariosPorTurma.get(t.id as string) ?? [],
      }))
      .sort((a, b) => b.alunos - a.alunos),
    totalAlunos: distintos.size,
    horasSemanais: Number(horasSemanais.toFixed(1)),
    dna:
      notas.length > 0
        ? {
            media: Number((notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(2)),
            avaliacoes: notas.length,
          }
        : null,
  };
}
