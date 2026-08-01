import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ClassScheduleWeekday } from "@/features/classes/schemas";
import { datasDeAula, normalizarMes, type DataDeAula } from "./presenca-datas";

export type StatusPresenca = "presente" | "falta" | "justificada";

export type AlunoDaChamada = {
  studentId: string;
  enrollmentId: string;
  nome: string;
};

export type DataDaChamada = DataDeAula & {
  cancelada: boolean;
  motivoCancelamento: string | null;
};

export type ChamadaDaTurma = {
  turmaId: string;
  turmaNome: string;
  professorNome: string;
  mes: string;
  alunos: AlunoDaChamada[];
  datas: DataDaChamada[];
  /** Chave `${studentId}|${dataIso}` → status. */
  registros: Record<string, StatusPresenca>;
};

/**
 * Tudo que a tela de chamada de uma turma precisa, num mês.
 *
 * Devolve os registros num objeto plano em vez de matriz: a tela precisa
 * responder "qual o status do aluno X no dia Y?" e não percorrer tudo.
 */
export async function getChamadaDaTurma(
  classId: string,
  mesBruto?: string,
): Promise<ChamadaDaTurma | null> {
  const mes = normalizarMes(mesBruto);
  const supabase = await createClient();

  const { data: turma, error: erroTurma } = await supabase
    .from("classes")
    .select("id, name, teacher_id, instructor_name")
    .eq("id", classId)
    .maybeSingle();

  if (erroTurma || !turma) {
    if (erroTurma) console.error("Chamada: turma", erroTurma.message);
    return null;
  }

  const [
    { data: horarios },
    { data: matriculas },
    { data: professor },
    { data: cancelamentos },
  ] = await Promise.all([
    supabase.from("class_schedules").select("weekday").eq("class_id", classId),
    supabase
      .from("enrollments")
      .select("id, student_id")
      .eq("class_id", classId)
      .eq("status", "active"),
    turma.teacher_id
      ? supabase
          .from("staff_members")
          .select("full_name, artistic_name")
          .eq("id", turma.teacher_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("aula_cancelada")
      .select("data, motivo")
      .eq("class_id", classId),
  ]);

  const diasDaSemana = [
    ...new Set(
      (horarios ?? []).map((h) => h.weekday as ClassScheduleWeekday),
    ),
  ];

  const idsDeAlunos = [
    ...new Set(
      (matriculas ?? [])
        .map((m) => m.student_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: alunosBrutos } =
    idsDeAlunos.length > 0
      ? await supabase
          .from("students")
          .select("id, full_name")
          .in("id", idsDeAlunos)
      : { data: [] };

  const nomePorId = new Map(
    (alunosBrutos ?? []).map((a) => [a.id as string, a.full_name as string]),
  );

  const alunos: AlunoDaChamada[] = (matriculas ?? [])
    .filter((m) => m.student_id)
    .map((m) => ({
      studentId: m.student_id as string,
      enrollmentId: m.id as string,
      nome: nomePorId.get(m.student_id as string) ?? "Aluno não encontrado",
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const canceladasPorData = new Map(
    (cancelamentos ?? []).map((c) => [
      c.data as string,
      (c.motivo as string | null) ?? null,
    ]),
  );

  const datas: DataDaChamada[] = datasDeAula(diasDaSemana, mes).map((d) => ({
    ...d,
    cancelada: canceladasPorData.has(d.iso),
    motivoCancelamento: canceladasPorData.get(d.iso) ?? null,
  }));

  const registros: Record<string, StatusPresenca> = {};

  if (datas.length > 0) {
    const { data: presencas, error: erroPresencas } = await supabase
      .from("presenca")
      .select("student_id, data, status")
      .eq("class_id", classId)
      .gte("data", datas[0].iso)
      .lte("data", datas[datas.length - 1].iso);

    if (erroPresencas) {
      console.error("Chamada: presenças", erroPresencas.message);
    }

    for (const p of presencas ?? []) {
      registros[`${p.student_id as string}|${p.data as string}`] =
        p.status as StatusPresenca;
    }
  }

  return {
    turmaId: turma.id as string,
    turmaNome: turma.name as string,
    professorNome:
      (professor?.artistic_name as string | null)?.trim() ||
      (professor?.full_name as string | null) ||
      (turma.instructor_name as string | null) ||
      "Não informado",
    mes,
    alunos,
    datas,
    registros,
  };
}

export type AlunoEmRisco = {
  studentId: string;
  nome: string;
  turmaId: string;
  turmaNome: string;
  faltasSeguidas: number;
  ultimaFalta: string;
  ultimaPresenca: string | null;
};

/**
 * Alunos com faltas seguidas — quem está prestes a sumir.
 *
 * Conta para trás a partir da aula mais recente de cada aluno em cada turma e
 * para na primeira presença. Aula cancelada não entra na conta porque não
 * gera registro nenhum: ninguém faltou, não houve aula.
 *
 * Falta justificada QUEBRA a sequência, de propósito. Quem avisa que não vem
 * é justamente quem ainda fala com a escola — o alerta existe para achar o
 * silêncio, não para punir quem se comunicou.
 */
export async function getAlunosEmRisco(
  minimoDeFaltas = 3,
): Promise<AlunoEmRisco[]> {
  const supabase = await createClient();

  // 90 dias cobre o pior caso: turma de uma aula por semana, 3 faltas
  // seguidas, com margem para feriados no meio.
  const desde = new Date();
  desde.setDate(desde.getDate() - 90);
  const desdeISO = desde.toISOString().slice(0, 10);

  const { data: registros, error } = await supabase
    .from("presenca")
    .select("student_id, class_id, data, status")
    .gte("data", desdeISO)
    .order("data", { ascending: false });

  if (error) {
    console.error("Alunos em risco:", error.message);
    return [];
  }

  // Agrupa por aluno+turma, já em ordem decrescente de data.
  const porAlunoTurma = new Map<
    string,
    { studentId: string; classId: string; linhas: { data: string; status: string }[] }
  >();

  for (const r of registros ?? []) {
    const chave = `${r.student_id}|${r.class_id}`;
    const atual = porAlunoTurma.get(chave) ?? {
      studentId: r.student_id as string,
      classId: r.class_id as string,
      linhas: [],
    };
    atual.linhas.push({ data: r.data as string, status: r.status as string });
    porAlunoTurma.set(chave, atual);
  }

  const emRisco: Array<Omit<AlunoEmRisco, "nome" | "turmaNome">> = [];

  for (const { studentId, classId, linhas } of porAlunoTurma.values()) {
    let seguidas = 0;
    let ultimaFalta = "";
    let ultimaPresenca: string | null = null;

    for (const linha of linhas) {
      if (linha.status === "falta") {
        seguidas += 1;
        if (!ultimaFalta) ultimaFalta = linha.data;
        continue;
      }
      // presente ou justificada: a sequência acabou
      ultimaPresenca = linha.data;
      break;
    }

    if (seguidas >= minimoDeFaltas) {
      emRisco.push({
        studentId,
        turmaId: classId,
        faltasSeguidas: seguidas,
        ultimaFalta,
        ultimaPresenca,
      });
    }
  }

  if (emRisco.length === 0) return [];

  const [{ data: alunos }, { data: turmas }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name")
      .in("id", [...new Set(emRisco.map((e) => e.studentId))]),
    supabase
      .from("classes")
      .select("id, name")
      .in("id", [...new Set(emRisco.map((e) => e.turmaId))]),
  ]);

  const nomeAluno = new Map(
    (alunos ?? []).map((a) => [a.id as string, a.full_name as string]),
  );
  const nomeTurma = new Map(
    (turmas ?? []).map((t) => [t.id as string, t.name as string]),
  );

  return emRisco
    .map((e) => ({
      ...e,
      nome: nomeAluno.get(e.studentId) ?? "Aluno não encontrado",
      turmaNome: nomeTurma.get(e.turmaId) ?? "Turma não encontrada",
    }))
    .sort((a, b) => b.faltasSeguidas - a.faltasSeguidas);
}
