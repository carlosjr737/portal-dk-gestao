import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffDisplayName } from "@/features/staff/formatters";

export type TurmaPayment = {
  nivel: string;
  diasLabel: string;
  horario: string;
  horaAula: number;
  valorAluno: number;
  aulas: number;
  alunos: { nome: string; condicao: string }[];
  nAlunos: number;
  valorFixo: number;
  valorVariavel: number;
  total: number;
};

export type ProfessorPayment = {
  professor: string;
  turmas: TurmaPayment[];
  total: number;
};

export type TeacherPaymentData = {
  monthLabel: string;
  professores: ProfessorPayment[];
  grandTotal: number;
};

const WEEKDAY_JS: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};
const WEEKDAY_ABBR: Record<string, string> = {
  domingo: "Dom", segunda: "Seg", terca: "Ter", quarta: "Qua",
  quinta: "Qui", sexta: "Sex", sabado: "Sáb",
};
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Nº de aulas no mês = ocorrências dos dias da semana da turma (sem descontar recesso). */
function contarAulas(weekdays: string[], year: number, month: number): number {
  const dias = new Set(weekdays.map((w) => WEEKDAY_JS[w]).filter((d) => d !== undefined));
  if (dias.size === 0) return 0;
  const lastDay = new Date(year, month, 0).getDate(); // month é 1-based aqui
  let count = 0;
  for (let d = 1; d <= lastDay; d += 1) {
    if (dias.has(new Date(year, month - 1, d).getDay())) count += 1;
  }
  return count;
}

function labelDias(weekdays: string[]): string {
  const ordem = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
  const uniq = [...new Set(weekdays)].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
  const set = new Set(uniq);
  if (set.size === 2 && set.has("segunda") && set.has("quarta")) return "Seg e Qua";
  if (set.size === 2 && set.has("terca") && set.has("quinta")) return "Ter e Qui";
  return uniq.map((w) => WEEKDAY_ABBR[w] ?? w).join(" e ");
}

export async function getTeacherPaymentData(
  year: number,
  month: number, // 1-based
): Promise<TeacherPaymentData> {
  const admin = createAdminClient();
  const monthFirst = `${year}-${String(month).padStart(2, "0")}-01`;

  const [
    { data: rates },
    { data: classes },
    { data: schedules },
    { data: staff },
    { data: levels },
    { data: enrollments },
  ] = await Promise.all([
    admin
      .from("class_teacher_rate")
      .select("class_id, hora_aula, valor_por_aluno, vigencia_inicio, vigencia_fim")
      .lte("vigencia_inicio", monthFirst),
    admin.from("classes").select("id, teacher_id, level_id, status").eq("status", "active"),
    admin.from("class_schedules").select("class_id, weekday, start_time"),
    admin.from("staff_members").select("id, full_name, artistic_name"),
    admin.from("levels").select("id, name"),
    admin
      .from("enrollments")
      .select("class_id, status, discount_amount, student_id")
      .eq("status", "active"),
  ]);

  // rate vigente no mês (mais recente que cobre o mês)
  const rateByClass = new Map<string, { hora: number; aluno: number; inicio: string }>();
  for (const r of rates ?? []) {
    const fim = r.vigencia_fim as string | null;
    if (fim && fim < monthFirst) continue; // já expirou antes do mês
    const cur = rateByClass.get(r.class_id as string);
    const inicio = r.vigencia_inicio as string;
    if (!cur || inicio > cur.inicio) {
      rateByClass.set(r.class_id as string, {
        hora: Number(r.hora_aula ?? 0),
        aluno: Number(r.valor_por_aluno ?? 0),
        inicio,
      });
    }
  }

  const levelName = new Map((levels ?? []).map((l) => [l.id as string, l.name as string]));
  const staffName = new Map((staff ?? []).map((s) => [s.id as string, getStaffDisplayName(s)]));
  const classById = new Map((classes ?? []).map((c) => [c.id as string, c]));

  const schedByClass = new Map<string, { weekdays: string[]; minTime: string }>();
  for (const s of schedules ?? []) {
    const cid = s.class_id as string;
    const cur = schedByClass.get(cid) ?? { weekdays: [], minTime: "99:99" };
    cur.weekdays.push(s.weekday as string);
    const t = (s.start_time as string).slice(0, 5);
    if (t < cur.minTime) cur.minTime = t;
    schedByClass.set(cid, cur);
  }

  // roster por turma (só das que têm rate)
  const studentIds = [
    ...new Set((enrollments ?? []).map((e) => e.student_id as string).filter(Boolean)),
  ];
  const { data: students } =
    studentIds.length > 0
      ? await admin.from("students").select("id, full_name").in("id", studentIds)
      : { data: [] as { id: string; full_name: string }[] };
  const studentName = new Map(
    (students ?? []).map((s) => [s.id as string, s.full_name as string]),
  );

  const rosterByClass = new Map<string, { nome: string; condicao: string }[]>();
  for (const e of enrollments ?? []) {
    const cid = e.class_id as string;
    if (!rateByClass.has(cid)) continue;
    const list = rosterByClass.get(cid) ?? [];
    list.push({
      nome: studentName.get(e.student_id as string) ?? "—",
      condicao: Number(e.discount_amount ?? 0) > 0 ? "Desconto/Bolsa" : "",
    });
    rosterByClass.set(cid, list);
  }

  // monta por professor
  const byProf = new Map<string, ProfessorPayment>();
  for (const [classId, rate] of rateByClass) {
    const cls = classById.get(classId);
    if (!cls) continue;
    const prof = staffName.get(cls.teacher_id as string) ?? "—";
    const sched = schedByClass.get(classId) ?? { weekdays: [], minTime: "-" };
    const aulas = contarAulas(sched.weekdays, year, month);
    const alunos = (rosterByClass.get(classId) ?? []).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
    const n = alunos.length;
    const vf = rate.hora * aulas;
    const vv = rate.aluno * n;
    const turma: TurmaPayment = {
      nivel: cls.level_id ? levelName.get(cls.level_id as string) ?? "—" : "—",
      diasLabel: labelDias(sched.weekdays),
      horario: sched.minTime,
      horaAula: rate.hora,
      valorAluno: rate.aluno,
      aulas,
      alunos,
      nAlunos: n,
      valorFixo: vf,
      valorVariavel: vv,
      total: vf + vv,
    };
    const pp = byProf.get(prof) ?? { professor: prof, turmas: [], total: 0 };
    pp.turmas.push(turma);
    pp.total += turma.total;
    byProf.set(prof, pp);
  }

  const professores = [...byProf.values()]
    .map((p) => ({
      ...p,
      turmas: p.turmas.sort((a, b) => a.nivel.localeCompare(b.nivel, "pt-BR")),
    }))
    .sort((a, b) => a.professor.localeCompare(b.professor, "pt-BR"));

  return {
    monthLabel: `${MESES[month - 1]}/${year}`,
    professores,
    grandTotal: professores.reduce((s, p) => s + p.total, 0),
  };
}
