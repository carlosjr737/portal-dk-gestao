import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStaffDisplayName } from "@/features/staff/formatters";
import { getTeacherPaymentData } from "@/features/teacher-payments/queries";

/**
 * Receita × custo por professor, no último mês fechado.
 *
 * O CUSTO NÃO É RECALCULADO AQUI. Ele vem de `getTeacherPaymentData`, que é o
 * mesmo cálculo do fechamento — inclusive a vigência do modelo de
 * remuneração. Refazer a conta neste arquivo criaria dois números para a
 * mesma pergunta, e quando divergissem ninguém saberia qual pagar.
 *
 * O QUE "RECEITA DO PROFESSOR" É, E O QUE NÃO É
 * É a mensalidade das matrículas ativas nas turmas que ele dá. Não é mérito
 * dele sozinho: a turma existiria com outro professor e a família paga pela
 * vaga, não pelo nome. O número serve para achar turma que não se paga — não
 * para ranquear gente.
 *
 * Por isso a tela mostra margem por TURMA junto: um professor com margem
 * baixa costuma ter uma turma vazia no meio de turmas cheias, e o total
 * esconde exatamente isso.
 *
 * MÊS FECHADO, NÃO O CORRENTE. Mês pela metade tem o custo quase inteiro (as
 * aulas já aconteceram) contra uma receita que ainda vai entrar — a margem
 * apareceria negativa todo dia 5 e positiva todo dia 30.
 */

export type TurmaDoProfessor = {
  turma: string;
  alunos: number;
  /** Mensalidades das matrículas ativas desta turma, já com desconto. */
  receita: number;
  custo: number;
  aulas: number;
  horas: number;
};

export type MetricaProfessor = {
  professor: string;
  turmas: number;
  /** Alunos DISTINTOS. Quem faz duas turmas com o mesmo professor conta uma vez. */
  alunos: number;
  /** Matrículas. Duas turmas do mesmo aluno pagam duas vezes. */
  matriculas: number;
  receita: number;
  custo: number;
  /** Receita menos custo. Não é lucro: falta sala, estrutura e impostos. */
  margem: number;
  /** Quanto do que a turma arrecada vai para o professor. */
  custoSobreReceita: number | null;
  horas: number;
  aulas: number;
  /** Custo ÷ horas. O que a hora dele custa de verdade, já com o variável. */
  custoPorHora: number | null;
  /** Receita ÷ horas. O que a hora dele traz. */
  receitaPorHora: number | null;
  alunosPorTurma: number;
  detalhe: TurmaDoProfessor[];
  /** Alguma turma sem modelo de remuneração: o custo está incompleto. */
  temPendencia: boolean;
};

export type MetricasProfessores = {
  competenciaLabel: string;
  ano: number;
  mes: number;
  professores: MetricaProfessor[];
  totais: {
    receita: number;
    custo: number;
    margem: number;
    horas: number;
    turmas: number;
    alunos: number;
  };
  /** Turmas sem professor: a receita delas não entra em ninguém. */
  turmasSemProfessor: number;
  receitaSemProfessor: number;
  /**
   * O fechamento não carregou — falta rodar `remuneracao_03_lote.sql`. A
   * receita e as horas continuam certas; o custo vem zero, e a tela precisa
   * dizer isso em vez de exibir margem igual à receita.
   */
  custoIndisponivel: string | null;
};

const WEEKDAY_JS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Quantas vezes este dia da semana cai no mês. */
function ocorrenciasNoMes(weekday: string, year: number, month: number): number {
  const alvo = WEEKDAY_JS[weekday];
  if (alvo === undefined) return 0;
  const ultimo = new Date(year, month, 0).getDate();
  let n = 0;
  for (let d = 1; d <= ultimo; d += 1) {
    if (new Date(year, month - 1, d).getDay() === alvo) n += 1;
  }
  return n;
}

/** Último mês FECHADO. Em agosto devolve julho. */
export function ultimoMesFechado(hoje = new Date()): { ano: number; mes: number } {
  const m = hoje.getMonth(); // 0-11; o mês anterior em base 1 é exatamente este
  return m === 0
    ? { ano: hoje.getFullYear() - 1, mes: 12 }
    : { ano: hoje.getFullYear(), mes: m };
}

export async function getMetricasProfessores(
  ano?: number,
  mes?: number,
): Promise<MetricasProfessores> {
  const alvo = ano && mes ? { ano, mes } : ultimoMesFechado();
  const supabase = await createClient();

  /*
   * O fechamento LANÇA quando o modelo de remuneração não está no banco. Aqui
   * isso não pode derrubar a tela inteira: receita, alunos e horas não
   * dependem dele, e são metade da pergunta. O custo vira zero e a tela avisa
   * — margem inflada sem aviso seria pior que tela quebrada.
   */
  let custoIndisponivel: string | null = null;
  const pagamentosPromise = getTeacherPaymentData(alvo.ano, alvo.mes).catch(
    (e: unknown) => {
      custoIndisponivel =
        e instanceof Error ? e.message : "Não foi possível carregar o custo.";
      return null;
    },
  );

  const [pagamentos, turmasRes, matriculasRes, horariosRes, professoresRes] =
    await Promise.all([
      pagamentosPromise,
      supabase
        .from("classes")
        .select("id, name, teacher_id")
        .eq("status", "active"),
      supabase
        .from("enrollments")
        .select("class_id, student_id, monthly_amount, discount_amount")
        .eq("status", "active"),
      supabase
        .from("class_schedules")
        .select("class_id, weekday, start_time, end_time"),
      /*
       * `staff_members`, e não `teachers`: é a MESMA fonte que o fechamento
       * usa. Cruzar o custo (agrupado por nome) com uma tabela diferente
       * casaria por texto parecido e erraria em silêncio — professor com nome
       * artístico ficaria sem custo, e ninguém veria.
       */
      supabase
        .from("staff_members")
        .select("id, full_name, artistic_name")
        .eq("role", "professor"),
    ]);

  // Mesma função do fechamento, e recebendo o objeto inteiro: ela prefere o
  // nome artístico, e passar só `full_name` mudaria o nome de quem tem um.
  const nomePorId = new Map(
    (professoresRes.data ?? []).map((t) => [
      t.id as string,
      getStaffDisplayName(
        t as { full_name: string; artistic_name: string | null },
      ),
    ]),
  );

  /*
   * O fechamento agrupa por NOME do professor, não por id. Para cruzar as
   * duas fontes o nome precisa passar pela mesma normalização — senão
   * "Ruan Lopes" e "Ruan" viram professores diferentes e o custo fica órfão.
   */
  const custoPorTurma = new Map<string, { custo: number; aulas: number; pendente: boolean }>();
  const custoPorProfessor = new Map<string, number>();
  for (const p of pagamentos?.professores ?? []) {
    custoPorProfessor.set(p.professor, p.total);
    for (const t of p.turmas) {
      // A chave do fechamento é nível + horário; aqui basta o total do professor
      // e o rateio por turma vem da mesma lista, na ordem em que ela veio.
      custoPorTurma.set(`${p.professor}::${t.nivel}::${t.horario}`, {
        custo: t.total,
        aulas: t.aulas,
        pendente: t.pendente,
      });
    }
  }

  /* Receita e alunos por turma. */
  const receitaPorTurma = new Map<string, number>();
  const alunosPorTurma = new Map<string, Set<string>>();
  const matriculasPorTurma = new Map<string, number>();
  for (const e of matriculasRes.data ?? []) {
    const turma = e.class_id as string | null;
    if (!turma) continue;
    const liquido = Math.max(
      0,
      Number(e.monthly_amount ?? 0) - Number(e.discount_amount ?? 0),
    );
    receitaPorTurma.set(turma, (receitaPorTurma.get(turma) ?? 0) + liquido);
    matriculasPorTurma.set(turma, (matriculasPorTurma.get(turma) ?? 0) + 1);
    const s = alunosPorTurma.get(turma) ?? new Set<string>();
    if (e.student_id) s.add(e.student_id as string);
    alunosPorTurma.set(turma, s);
  }

  /*
   * Horas do mês: duração de cada faixa semanal × quantas vezes aquele dia
   * cai no mês. Não é `aulas × 1h` — a duração real vai de 45 min a 1h30, e
   * arredondar para uma hora distorce o custo por hora de quem dá aula longa.
   */
  const horasPorTurma = new Map<string, number>();
  const aulasPorTurma = new Map<string, number>();
  for (const h of horariosRes.data ?? []) {
    const turma = h.class_id as string | null;
    const inicio = h.start_time as string | null;
    const fim = h.end_time as string | null;
    if (!turma || !inicio || !fim) continue;
    const min = (t: string) => {
      const [hh, mm] = t.split(":").map(Number);
      return hh * 60 + mm;
    };
    const duracao = Math.max(0, min(fim) - min(inicio)) / 60;
    const vezes = ocorrenciasNoMes(h.weekday as string, alvo.ano, alvo.mes);
    horasPorTurma.set(turma, (horasPorTurma.get(turma) ?? 0) + duracao * vezes);
    aulasPorTurma.set(turma, (aulasPorTurma.get(turma) ?? 0) + vezes);
  }

  /* Agrupa por professor. */
  type Acc = {
    turmas: TurmaDoProfessor[];
    alunos: Set<string>;
    matriculas: number;
  };
  const porProfessor = new Map<string, Acc>();
  let turmasSemProfessor = 0;
  let receitaSemProfessor = 0;

  for (const c of turmasRes.data ?? []) {
    const turmaId = c.id as string;
    const receita = receitaPorTurma.get(turmaId) ?? 0;
    const professorId = c.teacher_id as string | null;
    const nome = professorId ? nomePorId.get(professorId) : null;

    /*
     * Turma sem professor não some: ela arrecada e o custo dela não tem dono.
     * Diluir na média de quem tem professor inventaria margem que não existe.
     */
    if (!nome) {
      turmasSemProfessor += 1;
      receitaSemProfessor += receita;
      continue;
    }

    const acc = porProfessor.get(nome) ?? {
      turmas: [],
      alunos: new Set<string>(),
      matriculas: 0,
    };
    for (const a of alunosPorTurma.get(turmaId) ?? []) acc.alunos.add(a);
    acc.matriculas += matriculasPorTurma.get(turmaId) ?? 0;
    acc.turmas.push({
      turma: (c.name as string) ?? "Turma",
      alunos: alunosPorTurma.get(turmaId)?.size ?? 0,
      receita,
      custo: 0, // preenchido abaixo, a partir do fechamento
      aulas: aulasPorTurma.get(turmaId) ?? 0,
      horas: Math.round((horasPorTurma.get(turmaId) ?? 0) * 10) / 10,
    });
    porProfessor.set(nome, acc);
  }

  const professores: MetricaProfessor[] = [];
  for (const [nome, acc] of porProfessor) {
    const receita = acc.turmas.reduce((s, t) => s + t.receita, 0);
    const custo = custoPorProfessor.get(nome) ?? 0;
    const horas = acc.turmas.reduce((s, t) => s + t.horas, 0);
    const aulas = acc.turmas.reduce((s, t) => s + t.aulas, 0);

    /*
     * O custo do fechamento é por professor, e o rateio por turma dele usa
     * chave de nível+horário que não bate com o id da turma daqui. Em vez de
     * casar por texto — que erra em silêncio — o detalhe por turma fica sem
     * custo e a tela mostra só receita e alunos por turma. O custo é do
     * professor, e é onde ele é confiável.
     */
    const pendente =
      pagamentos?.professores.find((p) => p.professor === nome)?.turmas.some(
        (t) => t.pendente,
      ) ?? false;

    professores.push({
      professor: nome,
      turmas: acc.turmas.length,
      alunos: acc.alunos.size,
      matriculas: acc.matriculas,
      receita,
      custo,
      margem: receita - custo,
      custoSobreReceita: receita > 0 ? (custo / receita) * 100 : null,
      horas: Math.round(horas * 10) / 10,
      aulas,
      custoPorHora: horas > 0 ? custo / horas : null,
      receitaPorHora: horas > 0 ? receita / horas : null,
      alunosPorTurma:
        acc.turmas.length > 0 ? acc.alunos.size / acc.turmas.length : 0,
      detalhe: acc.turmas.sort((a, b) => b.receita - a.receita),
      temPendencia: pendente,
    });
  }

  professores.sort((a, b) => b.margem - a.margem);

  return {
    competenciaLabel: `${MESES[alvo.mes - 1]} de ${alvo.ano}`,
    ano: alvo.ano,
    mes: alvo.mes,
    professores,
    totais: {
      receita: professores.reduce((s, p) => s + p.receita, 0),
      custo: professores.reduce((s, p) => s + p.custo, 0),
      margem: professores.reduce((s, p) => s + p.margem, 0),
      horas: Math.round(professores.reduce((s, p) => s + p.horas, 0) * 10) / 10,
      turmas: professores.reduce((s, p) => s + p.turmas, 0),
      alunos: professores.reduce((s, p) => s + p.alunos, 0),
    },
    turmasSemProfessor,
    receitaSemProfessor,
    custoIndisponivel,
  };
}
