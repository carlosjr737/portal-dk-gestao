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
  /**
   * De onde veio o valor: 'modelo' é a tabela do professor, 'excecao' é
   * valor negociado para esta turma. A tela mostra selo no segundo caso —
   * senão parece que a tabela está errada.
   */
  origem: "modelo" | "excecao" | "pendente";
  /** Modelo migrado que ninguém conferiu ainda. */
  revisado: boolean;
  /** Professor sem modelo de remuneração. Entra com zero e aparece. */
  pendente: boolean;
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
  /** Turmas sem modelo. Enquanto houver, o total está incompleto. */
  turmasPendentes: number;
  /** Turmas cujo modelo veio da migração e ninguém conferiu. */
  turmasNaoRevisadas: number;
};

/*
 * A REGRA DE PAGAMENTO SAIU DAQUI.
 *
 * Até agosto/2026 este arquivo tinha dois mapas fixos: CONTRATO_POR_PROFESSOR,
 * que escolhia o contrato pelo PRIMEIRO NOME normalizado, e RATE_CUSTOM, com
 * quatro turmas de valor negociado. Três problemas, e o terceiro é o grave:
 *
 *   1. Mudar remuneração exigia deploy.
 *   2. Professor novo caía em `?? "escalonado"` sem ninguém escolher.
 *   3. Editar o nome no cadastro trocava o contrato da pessoa em silêncio —
 *      e sempre para cima, porque o fallback era o modelo mais caro. Medido
 *      com os dados de julho: até R$ 1.935/mês a mais.
 *
 * Agora vem de `compensation_model`/`compensation_tier`, com vigência, e a
 * hierarquia (exceção da turma → modelo do professor → nada) mora numa função
 * do banco. Fechar maio em agosto continua usando a tabela de maio.
 */

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

  /*
   * A data que escolhe a VIGÊNCIA do modelo: o último dia do mês que está
   * fechando. Fechar maio em agosto usa a tabela que valia em maio, não a de
   * hoje — é o que impede uma correção de tarifa de reescrever o que já foi
   * pago.
   *
   * Último dia e não primeiro: quem corrigir uma tarifa errada no meio do mês
   * espera que a correção valha para o mês inteiro, que é o caso comum. Como
   * não há rateio por dia, é preciso escolher um dos dois, e este erra menos.
   */
  const ultimoDiaDoMes = new Date(year, month, 0);
  const referencia = `${ultimoDiaDoMes.getFullYear()}-${String(month).padStart(2, "0")}-${String(ultimoDiaDoMes.getDate()).padStart(2, "0")}`;

  const { data: remuneracoes, error: erroRemuneracao } = await supabase.rpc(
    "remuneracao_do_mes",
    { referencia },
  );

  if (erroRemuneracao) {
    /*
     * Falha visível, de propósito. A alternativa seria devolver o fechamento
     * com tudo zerado — e um mês de pagamento zerado que "carregou sem erro" é
     * pior que uma tela que não abre.
     *
     * A causa quase sempre é uma só: o script do banco ainda não rodou.
     */
    throw new Error(
      "Não foi possível carregar os modelos de remuneração. " +
        "Se o erro cita a função `remuneracao_do_mes`, rode " +
        "`scripts/remuneracao_03_lote.sql` no banco. " +
        `Detalhe: ${erroRemuneracao.message}`,
    );
  }

  /** O que a função do banco devolve, por turma. */
  type RemuneracaoResolvida = {
    hora: number;
    variavel: number;
    origem: "modelo" | "excecao" | "pendente";
    revisado: boolean;
    pendente: boolean;
  };

  const remuneracaoPorTurma = new Map<string, RemuneracaoResolvida>(
    (remuneracoes ?? []).map(
      (r: {
        class_id: string;
        origem: string;
        hourly_rate: number | string;
        per_student_rate: number | string;
        revisado: boolean;
        pendente: boolean;
      }) => [
        r.class_id,
        {
          hora: Number(r.hourly_rate),
          variavel: Number(r.per_student_rate),
          origem: r.origem as "modelo" | "excecao" | "pendente",
          revisado: r.revisado,
          pendente: r.pendente,
        },
      ],
    ),
  );

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

    /*
     * Turma sem linha na resolução não deveria acontecer — a função devolve
     * uma linha por turma ativa. Se acontecer, trata como pendente em vez de
     * inventar tarifa: zero visível é melhor que valor plausível errado.
     */
    const rate = remuneracaoPorTurma.get(classId) ?? {
      hora: 0,
      variavel: 0,
      origem: "pendente" as const,
      revisado: false,
      pendente: true,
    };

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
      origem: rate.origem,
      revisado: rate.revisado,
      pendente: rate.pendente,
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

  const todasAsTurmas = professores.flatMap((p) => p.turmas);

  return {
    monthLabel: `${MESES[month - 1]}/${year}`,
    professores,
    grandTotal: professores.reduce((s, p) => s + p.total, 0),
    turmasPendentes: todasAsTurmas.filter((t) => t.pendente).length,
    turmasNaoRevisadas: todasAsTurmas.filter((t) => !t.revisado && !t.pendente)
      .length,
  };
}
