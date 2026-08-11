import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A foto mensal das métricas.
 *
 * ┌─ POR QUE AS CONTAS SÃO REFEITAS AQUI, E NÃO REUSADAS ───────────────┐
 * │ `getSchoolMetrics()` responderia tudo isto — mas ela não recebe     │
 * │ escola e depende inteiramente da RLS para filtrar (zero filtro      │
 * │ explícito por escola_id no arquivo inteiro). Um cron não tem        │
 * │ sessão: chamada com o cliente admin, ela somaria TODAS as escolas   │
 * │ num número só.                                                      │
 * │                                                                     │
 * │ Então as consultas são refeitas com escola_id explícito. O risco    │
 * │ disso é conhecido e é o de duas definições de "receita" divergirem  │
 * │ com o tempo — por isso as regras abaixo foram COPIADAS de           │
 * │ school-metrics/queries.ts, com o nome da origem em cada uma. Se     │
 * │ mudar lá, muda aqui.                                                │
 * └─────────────────────────────────────────────────────────────────────┘
 */

/** school-metrics/queries.ts:109 */
const STATUS_MATRICULA_ATIVA = "active";
/** school-metrics/queries.ts:110 */
const STATUS_TURMA_ATIVA = "active";

/**
 * A definição oficial de receita do projeto, copiada de
 * school-metrics/queries.ts:200 (`netAmount`). O `Math.max(0, …)` existe
 * porque desconto maior que a mensalidade não vira receita negativa.
 */
function valorLiquido(bruto: unknown, desconto: unknown): number {
  return Math.max(0, Number(bruto ?? 0) - Number(desconto ?? 0));
}

export type Metrica = {
  chave: string;
  rotulo: string;
  formato: "numero" | "dinheiro" | "porcentagem";
  /** O que este número quer dizer, para a tela não precisar de legenda. */
  explicacao: string;
};

export const METRICAS: Metrica[] = [
  { chave: "alunos_ativos", rotulo: "Alunos ativos", formato: "numero",
    explicacao: "Pessoas distintas com pelo menos uma matrícula ativa." },
  { chave: "matriculas_ativas", rotulo: "Matrículas ativas", formato: "numero",
    explicacao: "Uma aluna em duas turmas conta duas vezes." },
  { chave: "turmas_ativas", rotulo: "Turmas ativas", formato: "numero",
    explicacao: "Turmas com status ativo." },
  { chave: "professores_ativos", rotulo: "Professores ativos", formato: "numero",
    explicacao: "Equipe com vínculo ativo." },
  { chave: "receita_liquida", rotulo: "Receita mensal", formato: "dinheiro",
    explicacao: "Soma das mensalidades ativas, já com desconto." },
  { chave: "receita_bruta", rotulo: "Receita bruta", formato: "dinheiro",
    explicacao: "Mesma soma, antes do desconto." },
  { chave: "desconto_total", rotulo: "Desconto concedido", formato: "dinheiro",
    explicacao: "Quanto a escola abriu mão no mês." },
  { chave: "ticket_medio_aluno", rotulo: "Ticket médio por aluno", formato: "dinheiro",
    explicacao: "Receita líquida dividida pelos alunos ativos." },
  { chave: "capacidade_total", rotulo: "Vagas totais", formato: "numero",
    explicacao: "Soma da capacidade das turmas ativas." },
  { chave: "ocupacao", rotulo: "Ocupação", formato: "porcentagem",
    explicacao: "Matrículas ativas sobre as vagas totais." },
];

export type Captura = { competencia: string; valores: Record<string, number> };

/** 'YYYY-MM' do mês anterior ao da data dada. */
export function competenciaFechada(hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Calcula as métricas de uma escola AGORA.
 *
 * "Agora" é literal e é a limitação central: isto fotografa o estado do
 * momento em que roda. Rodando no dia 1, o retrato é do mês que acabou de
 * fechar — e é por isso que o cron roda no dia 1, não no dia 15.
 */
export async function calcularMetricas(escolaId: string): Promise<Record<string, number>> {
  const admin = createAdminClient();

  const [matriculas, turmas, equipe] = await Promise.all([
    admin
      .from("enrollments")
      .select("student_id, status, monthly_amount, discount_amount")
      .eq("escola_id", escolaId)
      .eq("status", STATUS_MATRICULA_ATIVA),
    admin
      .from("classes")
      .select("id, capacity, status")
      .eq("escola_id", escolaId)
      .eq("status", STATUS_TURMA_ATIVA),
    // `status`, não `active`: staff_members não tem coluna booleana. Conferido
    // no information_schema — `active` teria quebrado a consulta inteira.
    admin
      .from("staff_members")
      .select("id, status")
      .eq("escola_id", escolaId)
      .eq("status", "active"),
  ]);

  const linhas = matriculas.data ?? [];

  const alunos = new Set(
    linhas.map((m) => m.student_id).filter((id): id is string => Boolean(id)),
  ).size;

  const liquida = linhas.reduce(
    (s, m) => s + valorLiquido(m.monthly_amount, m.discount_amount),
    0,
  );
  const bruta = linhas.reduce((s, m) => s + Number(m.monthly_amount ?? 0), 0);
  const desconto = linhas.reduce((s, m) => s + Number(m.discount_amount ?? 0), 0);

  const capacidade = (turmas.data ?? []).reduce(
    (s, t) => s + Number(t.capacity ?? 0),
    0,
  );

  return {
    alunos_ativos: alunos,
    matriculas_ativas: linhas.length,
    turmas_ativas: (turmas.data ?? []).length,
    professores_ativos: (equipe.data ?? []).length,
    receita_liquida: Number(liquida.toFixed(2)),
    receita_bruta: Number(bruta.toFixed(2)),
    desconto_total: Number(desconto.toFixed(2)),
    // Divisão por zero vira 0, não NaN: NaN quebraria o gráfico inteiro.
    ticket_medio_aluno: alunos > 0 ? Number((liquida / alunos).toFixed(2)) : 0,
    capacidade_total: capacidade,
    ocupacao: capacidade > 0 ? Number(((linhas.length / capacidade) * 100).toFixed(1)) : 0,
  };
}

export type ResultadoCaptura = {
  escolaId: string;
  competencia: string;
  gravadas: number;
  erro?: string;
};

/**
 * Grava a foto de uma escola.
 *
 * REGRAVAR É PERMITIDO, e é de propósito: rodar duas vezes no mesmo dia
 * sobrescreve com o mesmo número, e uma correção de cadastro feita no dia 1
 * entra se o lote for repetido. O que NÃO acontece é uma competência antiga
 * ser reescrita meses depois — para isso teria que rodar de novo de propósito,
 * e aí o `origem` vira o registro de que aquilo não é mais o retrato original.
 */
export async function capturarEscola(
  escolaId: string,
  competencia: string,
  origem: "fechamento" | "reconstruido" = "fechamento",
): Promise<ResultadoCaptura> {
  const admin = createAdminClient();

  try {
    const valores = await calcularMetricas(escolaId);
    const linhas = Object.entries(valores).map(([metrica, valor]) => ({
      escola_id: escolaId,
      competencia,
      metrica,
      valor,
      origem,
      capturado_em: new Date().toISOString(),
    }));

    const { error } = await admin
      .from("metrica_mensal")
      .upsert(linhas, { onConflict: "escola_id,competencia,metrica" });

    if (error) return { escolaId, competencia, gravadas: 0, erro: error.message };
    return { escolaId, competencia, gravadas: linhas.length };
  } catch (e) {
    return {
      escolaId,
      competencia,
      gravadas: 0,
      erro: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Fotografa todas as escolas. Uma com problema não derruba as outras. */
export async function capturarTodasAsEscolas(
  competencia: string,
): Promise<ResultadoCaptura[]> {
  const admin = createAdminClient();
  const { data: escolas } = await admin.from("school").select("id");

  const resultados: ResultadoCaptura[] = [];
  for (const e of escolas ?? []) {
    resultados.push(await capturarEscola(e.id as string, competencia));
  }
  return resultados;
}
