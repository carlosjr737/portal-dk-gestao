import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Evolução da base ativa, mês a mês, por escola.
 *
 * POR QUE ISTO E NÃO UMA "TAXA DE CHURN"
 *
 * Churn como taxa precisa de dois números que descrevam o mesmo mundo:
 * quantos saíram, sobre quantos havia. Aqui as duas fontes disponíveis
 * discordam, e não de leve:
 *
 *   mês      saídas no log de eventos   cancelamentos nas matrículas
 *   2026-02  17                         0
 *   2026-03  19                         0
 *   2026-04  22                         0
 *   2026-06  22                         38
 *
 * O log (`growth_churn_events`) parece histórico importado da planilha da
 * escola; os cancelamentos (`enrollments.cancelled_at`) só passaram a ser
 * preenchidos de verdade em maio. Dividir um pelo outro produziria um número
 * com aparência de precisão e nenhuma verdade dentro.
 *
 * A base ativa, ao contrário, é auto-consistente: conta quantas matrículas
 * já tinham começado e ainda não tinham sido canceladas ao fim de cada mês.
 * Numerador e denominador saem da mesma fonte, então a VARIAÇÃO entre dois
 * meses é confiável — e é ela que responde "estamos encolhendo?", que é a
 * pergunta por trás do pedido de churn.
 *
 * A contagem de entradas e saídas continua no painel, do log de eventos,
 * como CONTAGEM. O que não existe é a divisão entre as duas.
 */

export type PontoBase = {
  /** 2026-08 */
  mes: string;
  /** ago/26 */
  rotulo: string;
  matriculas: number;
  alunos: number;
};

export type BaseEscola = {
  escolaId: string;
  pontos: PontoBase[];
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Fevereiro/2026 — o mês da primeira matrícula no sistema. */
const INICIO = { ano: 2026, mes: 1 };

export async function getEvolucaoDaBase(): Promise<BaseEscola[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("enrollments")
    .select("escola_id, student_id, start_date, cancelled_at");

  if (error) {
    console.error("Evolução da base:", error.message);
    return [];
  }

  const linhas = data ?? [];
  const hoje = new Date();

  // Monta a lista de meses uma vez só.
  const meses: Array<{ mes: string; rotulo: string; fim: string }> = [];
  let ano = INICIO.ano;
  let m = INICIO.mes;
  while (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && m <= hoje.getMonth())) {
    const ultimoDia = new Date(ano, m + 1, 0).getDate();
    meses.push({
      mes: `${ano}-${String(m + 1).padStart(2, "0")}`,
      rotulo: `${MESES[m]}/${String(ano).slice(2)}`,
      fim: `${ano}-${String(m + 1).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`,
    });
    m += 1;
    if (m > 11) {
      m = 0;
      ano += 1;
    }
  }

  const porEscola = new Map<string, typeof linhas>();
  for (const l of linhas) {
    const k = l.escola_id as string | null;
    if (!k) continue;
    porEscola.set(k, [...(porEscola.get(k) ?? []), l]);
  }

  return [...porEscola.entries()].map(([escolaId, doEscola]) => ({
    escolaId,
    pontos: meses.map((mes) => {
      let matriculas = 0;
      const alunos = new Set<string>();

      for (const l of doEscola) {
        const inicio = (l.start_date as string | null)?.slice(0, 10);
        if (!inicio || inicio > mes.fim) continue;
        const cancelamento = (l.cancelled_at as string | null)?.slice(0, 10);
        if (cancelamento && cancelamento <= mes.fim) continue;
        matriculas += 1;
        if (l.student_id) alunos.add(l.student_id as string);
      }

      return {
        mes: mes.mes,
        rotulo: mes.rotulo,
        matriculas,
        alunos: alunos.size,
      };
    }),
  }));
}

/**
 * Variação da base entre o primeiro e o último mês da série, em porcentagem.
 *
 * É o número que substitui a taxa de churn: diz se a escola cresceu ou
 * encolheu no período, sem depender de duas fontes que discordam.
 */
export function variacaoDaBase(pontos: PontoBase[]) {
  if (pontos.length < 2) return null;
  const inicio = pontos[0].matriculas;
  const fim = pontos[pontos.length - 1].matriculas;
  if (inicio === 0) return null;
  return ((fim - inicio) / inicio) * 100;
}

/** Variação só do último mês contra o anterior. */
export function variacaoMesAMes(pontos: PontoBase[]) {
  if (pontos.length < 2) return null;
  const anterior = pontos[pontos.length - 2].matriculas;
  const atual = pontos[pontos.length - 1].matriculas;
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}
