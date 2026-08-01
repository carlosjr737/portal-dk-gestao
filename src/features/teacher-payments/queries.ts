import "server-only";

import { createClient } from "@/lib/supabase/server";
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

// ---------------------------------------------------------------------------
// Regra de pagamento (dos contratos). Bonificação conta ALUNOS ATIVOS (opção A).
// ---------------------------------------------------------------------------
type ContratoTipo = "escalonado" | "fixo60" | "zion";

// Tipo de contrato por professor (nome de exibição, normalizado).
const CONTRATO_POR_PROFESSOR: Record<string, ContratoTipo> = {
  carol: "escalonado", dener: "escalonado", gladson: "escalonado",
  livia: "escalonado", marcella: "escalonado", nagao: "escalonado",
  rick: "escalonado", ruan: "escalonado",
  carolzinha: "fixo60", laura: "fixo60", red: "fixo60",
  sarah: "fixo60", guedes: "fixo60",
  zion: "zion",
};

// Turmas com valor negociado (fora da tabela escalonada).
const RATE_CUSTOM: Record<string, { hora: number; variavel: number }> = {
  "c6758f4b-430b-4ec0-bbe9-f892fb920928": { hora: 140.25, variavel: 30 }, // Ruan Equipe Junior
  "d2ef0403-8997-4b64-999a-675a8faabf4d": { hora: 140.25, variavel: 30 }, // Ruan Equipe Juvenil
  "ff79adf5-9791-4c14-b3d6-136d6cf7d878": { hora: 165.0, variavel: 30 },  // Marcella Sáb
  "d34a38be-eb57-448a-bdd4-9276f527c4fd": { hora: 115.5, variavel: 0 },   // Carol Sáb
};

function tarifa(tipo: ContratoTipo, n: number): { hora: number; variavel: number } {
  if (tipo === "fixo60") return { hora: 60.5, variavel: 0 };
  if (tipo === "zion") {
    if (n <= 5) return { hora: 60.5, variavel: 0 };
    if (n <= 10) return { hora: 60.5, variavel: 15 };
    return { hora: 60.5, variavel: 30 };
  }
  // escalonado
  if (n <= 3) return { hora: 60.5, variavel: 0 };
  if (n <= 5) return { hora: 77.0, variavel: 0 };
  if (n <= 10) return { hora: 77.0, variavel: 15 };
  if (n <= 15) return { hora: 77.0, variavel: 30 };
  return { hora: 93.5, variavel: 30 };
}

function normProf(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

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

function contarAulas(weekdays: string[], year: number, month: number): number {
  const dias = new Set(weekdays.map((w) => WEEKDAY_JS[w]).filter((d) => d !== undefined));
  if (dias.size === 0) return 0;
  const lastDay = new Date(year, month, 0).getDate();
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
  month: number,
): Promise<TeacherPaymentData> {
  // Cliente com RLS: o isolamento por escola é garantido pelas policies.
  const supabase = await createClient();

  const [
    { data: classes },
    { data: schedules },
    { data: staff },
    { data: levels },
    { data: enrollments },
  ] = await Promise.all([
    supabase.from("classes").select("id, teacher_id, level_id, status").eq("status", "active"),
    supabase.from("class_schedules").select("class_id, weekday, start_time"),
    supabase.from("staff_members").select("id, full_name, artistic_name").eq("role", "professor"),
    supabase.from("levels").select("id, name"),
    supabase
      .from("enrollments")
      .select("class_id, status, discount_amount, student_id")
      .eq("status", "active"),
  ]);

  const staffIds = new Set((staff ?? []).map((s) => s.id as string));
  const levelName = new Map((levels ?? []).map((l) => [l.id as string, l.name as string]));
  const staffName = new Map((staff ?? []).map((s) => [s.id as string, getStaffDisplayName(s)]));

  const schedByClass = new Map<string, { weekdays: string[]; minTime: string }>();
  for (const s of schedules ?? []) {
    const cid = s.class_id as string;
    const cur = schedByClass.get(cid) ?? { weekdays: [], minTime: "99:99" };
    cur.weekdays.push(s.weekday as string);
    const t = (s.start_time as string).slice(0, 5);
    if (t < cur.minTime) cur.minTime = t;
    schedByClass.set(cid, cur);
  }

  const studentIds = [
    ...new Set((enrollments ?? []).map((e) => e.student_id as string).filter(Boolean)),
  ];
  const { data: students } =
    studentIds.length > 0
      ? await supabase.from("students").select("id, full_name").in("id", studentIds)
      : { data: [] as { id: string; full_name: string }[] };
  const studentName = new Map(
    (students ?? []).map((s) => [s.id as string, s.full_name as string]),
  );

  const rosterByClass = new Map<string, { nome: string; condicao: string }[]>();
  for (const e of enrollments ?? []) {
    const cid = e.class_id as string;
    const list = rosterByClass.get(cid) ?? [];
    list.push({
      nome: studentName.get(e.student_id as string) ?? "—",
      condicao: Number(e.discount_amount ?? 0) > 0 ? "Desconto/Bolsa" : "",
    });
    rosterByClass.set(cid, list);
  }

  const byProf = new Map<string, ProfessorPayment>();
  for (const cls of classes ?? []) {
    const teacherId = cls.teacher_id as string | null;
    if (!teacherId || !staffIds.has(teacherId)) continue;
    const classId = cls.id as string;
    const prof = staffName.get(teacherId) ?? "—";
    const sched = schedByClass.get(classId) ?? { weekdays: [], minTime: "-" };
    const aulas = contarAulas(sched.weekdays, year, month);
    const alunos = (rosterByClass.get(classId) ?? []).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
    const n = alunos.length;

    const custom = RATE_CUSTOM[classId];
    const tipo = CONTRATO_POR_PROFESSOR[normProf(prof)] ?? "escalonado";
    const rate = custom ?? tarifa(tipo, n);

    const vf = rate.hora * aulas;
    const vv = rate.variavel * n;
    const turma: TurmaPayment = {
      nivel: cls.level_id ? levelName.get(cls.level_id as string) ?? "—" : "—",
      diasLabel: labelDias(sched.weekdays),
      horario: sched.minTime,
      horaAula: rate.hora,
      valorAluno: rate.variavel,
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
