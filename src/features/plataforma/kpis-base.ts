import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Evolução da base ativa e taxa de churn, mês a mês, por escola.
 *
 * AS DUAS FONTES, E QUAL RESPONDE O QUÊ
 *
 * `growth_churn_events` é a fonte oficial de FLUXO (quem entrou, quem saiu);
 * `enrollments` é a fonte oficial de ESTOQUE (quantos havia). Desde o trigger
 * `trg_growth_churn_from_enrollment` (scripts/growth_churn_01_trigger.sql), o
 * evento é gravado pelo próprio banco a cada matrícula criada ou cancelada —
 * inclusive por SQL direto. As duas fontes deixaram de poder divergir, porque
 * uma passou a ser consequência da outra.
 *
 * POR QUE A SÉRIE COMEÇA EM AGOSTO E NÃO EM FEVEREIRO
 *
 * O histórico anterior não é recuperável, e não por descuido de registro:
 *
 *   - Os 198 eventos de fev a jun vieram da planilha da escola
 *     (`source = 'planilha_2026'`) e não têm `enrollment_id`. As 88 saídas do
 *     período são de alunos que já tinham ido embora ANTES da importação —
 *     eles nunca existiram como matrícula aqui, então não há `cancelled_at`
 *     para retroalimentar.
 *   - As 700 matrículas da importação de 20/05/2026 têm `start_date` de
 *     01/02/2026 porque é o que a escola declarou. É data de importação, não
 *     de entrada — por isso ficam marcadas com `imported_at` e não geram
 *     evento.
 *   - 42 cancelamentos de mai/jun/jul foram feitos por SQL direto, sem evento.
 *
 * Dividir saídas de uma fonte pela base da outra, nesse período, daria um
 * número com cara de precisão e nada de verdade dentro. Então a taxa
 * simplesmente não existe antes de `INICIO_DA_SERIE_DE_CHURN` — a evolução da
 * base cobre o período anterior, que é auto-consistente por construção.
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

/** "2026-08" → "ago/26" */
export function rotuloDoMes(mes: string) {
  const [ano, m] = mes.split("-");
  return `${MESES[Number(m) - 1]}/${ano.slice(2)}`;
}

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

/**
 * Primeiro mês em que entradas e saídas nascem do trigger, e não de planilha
 * ou de SQL avulso. Antes disso a taxa não é calculada — ver o cabeçalho.
 *
 * Se o script `growth_churn_01_trigger.sql` só for aplicado depois de agosto,
 * mova esta constante para o primeiro mês INTEIRO coberto pelo trigger: um mês
 * que começou sem instrumentação tem saídas faltando e produziria uma taxa
 * baixa demais, que é o erro mais perigoso deste indicador.
 */
export const INICIO_DA_SERIE_DE_CHURN = "2026-08";

export type PontoChurn = {
  /** 2026-08 */
  mes: string;
  /** ago/26 */
  rotulo: string;
  saidas: number;
  /** Matrículas ativas no primeiro dia do mês — o denominador. */
  baseInicial: number;
  /** Em porcentagem. `null` quando a base do início do mês era zero. */
  taxa: number | null;
};

export type ChurnEscola = {
  escolaId: string;
  pontos: PontoChurn[];
};

/**
 * Taxa de churn = saídas do mês ÷ base ativa no primeiro dia do mês.
 *
 * O denominador é a base no FIM do mês anterior, que é a mesma coisa e já vem
 * calculada em `getEvolucaoDaBase`. Quem entrou e saiu dentro do mesmo mês
 * conta no numerador sem contar no denominador — é assim mesmo: a pergunta é
 * "de quem estava aqui no dia 1º, quantos perdi?", e o aluno que entrou no dia
 * 10 não estava.
 */
export async function getChurnMensal(
  evolucao: BaseEscola[],
): Promise<ChurnEscola[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("growth_churn_events")
    .select("escola_id, event_date")
    .eq("event_type", "saida")
    .gte("event_date", `${INICIO_DA_SERIE_DE_CHURN}-01`);

  if (error) {
    console.error("Churn mensal:", error.message);
    return [];
  }

  const saidasPor = new Map<string, number>();
  for (const e of data ?? []) {
    const escola = e.escola_id as string | null;
    const mes = (e.event_date as string | null)?.slice(0, 7);
    if (!escola || !mes) continue;
    const chave = `${escola}:${mes}`;
    saidasPor.set(chave, (saidasPor.get(chave) ?? 0) + 1);
  }

  return evolucao.map(({ escolaId, pontos }) => ({
    escolaId,
    pontos: pontos.flatMap((ponto, i) => {
      if (ponto.mes < INICIO_DA_SERIE_DE_CHURN) return [];
      // Sem o mês anterior na série não há denominador.
      const baseInicial = pontos[i - 1]?.matriculas;
      if (baseInicial === undefined) return [];

      const saidas = saidasPor.get(`${escolaId}:${ponto.mes}`) ?? 0;
      return [
        {
          mes: ponto.mes,
          rotulo: ponto.rotulo,
          saidas,
          baseInicial,
          taxa: baseInicial === 0 ? null : (saidas / baseInicial) * 100,
        },
      ];
    }),
  }));
}

/**
 * Soma as escolas em uma série só.
 *
 * A taxa do total é recalculada a partir das somas, nunca pela média das
 * taxas: uma escola de 20 alunos que perde 2 não pesa o mesmo que uma de 700
 * que perde 2, e a média simples fingiria que sim.
 */
export function agregarChurn(escolas: ChurnEscola[]): PontoChurn[] {
  const porMes = new Map<string, PontoChurn>();

  for (const { pontos } of escolas) {
    for (const p of pontos) {
      const atual = porMes.get(p.mes);
      if (atual) {
        atual.saidas += p.saidas;
        atual.baseInicial += p.baseInicial;
      } else {
        porMes.set(p.mes, { ...p });
      }
    }
  }

  return [...porMes.values()]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((p) => ({
      ...p,
      taxa: p.baseInicial === 0 ? null : (p.saidas / p.baseInicial) * 100,
    }));
}

/**
 * O último mês que já acabou.
 *
 * O mês corrente fica de fora de propósito: no dia 3, ele mostraria as saídas
 * de três dias sobre a base do mês inteiro, e o número pareceria uma melhora
 * enorme todo início de mês.
 */
export function churnDoUltimoMesFechado(pontos: PontoChurn[]) {
  const hoje = new Date();
  const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const fechados = pontos.filter((p) => p.mes < mesCorrente);
  return fechados[fechados.length - 1] ?? null;
}
