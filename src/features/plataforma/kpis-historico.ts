import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { estatisticasCobrancas } from "@/features/baas/asaas-client";

/**
 * Histórico de faturamento das escolas, mês a mês.
 *
 * Existe porque um número sozinho não decide nada. "R$ 12.400 recebidos em
 * agosto" só vira informação ao lado de julho: caiu, subiu ou está igual.
 *
 * CUSTO, E ELE IMPORTA: são 3 consultas ao Asaas por mês por escola (os três
 * status que significam "dinheiro entrou"). Com 6 meses, dá 18 por escola.
 * Para 1 escola são 18 chamadas em paralelo e a tela abre rápido; para 20
 * escolas seriam 360, e aí isto precisa virar cache noturno numa tabela
 * nossa, não consulta ao vivo.
 *
 * O limite está explícito em MAX_ESCOLAS_AO_VIVO: acima disso a tela mostra
 * só o mês corrente e diz por quê, em vez de demorar vinte segundos.
 */

/** Acima disso o histórico não é buscado ao vivo. */
export const MAX_ESCOLAS_AO_VIVO = 8;

const MESES = 6;

export type PontoMensal = {
  /** 2026-08 */
  mes: string;
  /** Ago */
  rotulo: string;
  recebido: number;
};

export type HistoricoEscola = {
  escolaId: string;
  pontos: PontoMensal[];
};

export type HistoricoResultado = {
  /** Por escola. Vazio quando não foi buscado. */
  porEscola: HistoricoEscola[];
  /** Soma de todas as escolas, mês a mês. */
  total: PontoMensal[];
  /** Preenchido quando o histórico NÃO foi buscado, com o motivo. */
  naoBuscado: string | null;
};

function janelaDeMeses(qtd: number) {
  const hoje = new Date();
  const meses: Array<{ mes: string; rotulo: string; de: string; ate: string }> = [];

  for (let i = qtd - 1; i >= 0; i -= 1) {
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    meses.push({
      mes: `${primeiro.getFullYear()}-${String(primeiro.getMonth() + 1).padStart(2, "0")}`,
      rotulo: new Intl.DateTimeFormat("pt-BR", { month: "short" })
        .format(primeiro)
        .replace(".", ""),
      de: iso(primeiro),
      ate: iso(ultimo),
    });
  }

  return meses;
}

export async function getHistoricoFaturamento(): Promise<HistoricoResultado> {
  const admin = createAdminClient();

  const { data: credenciais } = await admin
    .from("school_payment_credentials")
    .select("escola_id, api_key");

  const comChave = (credenciais ?? []).filter((c) => c.api_key);

  if (comChave.length === 0) {
    return {
      porEscola: [],
      total: [],
      naoBuscado: "Nenhuma escola com conta de pagamentos configurada.",
    };
  }

  if (comChave.length > MAX_ESCOLAS_AO_VIVO) {
    return {
      porEscola: [],
      total: [],
      naoBuscado: `Histórico desligado acima de ${MAX_ESCOLAS_AO_VIVO} escolas — seriam ${comChave.length * MESES * 3} consultas ao Asaas por carregamento. Precisa virar cache diário.`,
    };
  }

  const meses = janelaDeMeses(MESES);

  const porEscola = await Promise.all(
    comChave.map(async (c): Promise<HistoricoEscola> => {
      const chave = c.api_key as string;

      const pontos = await Promise.all(
        meses.map(async (m): Promise<PontoMensal> => {
          // Os mesmos três status de "entrou dinheiro" usados no painel.
          const [recebido, confirmado, emDinheiro] = await Promise.all([
            estatisticasCobrancas(chave, {
              status: "RECEIVED",
              vencimentoDe: m.de,
              vencimentoAte: m.ate,
            }),
            estatisticasCobrancas(chave, {
              status: "CONFIRMED",
              vencimentoDe: m.de,
              vencimentoAte: m.ate,
            }),
            estatisticasCobrancas(chave, {
              status: "RECEIVED_IN_CASH",
              vencimentoDe: m.de,
              vencimentoAte: m.ate,
            }),
          ]);

          const soma =
            (recebido.ok ? recebido.valorLiquido : 0) +
            (confirmado.ok ? confirmado.valorLiquido : 0) +
            (emDinheiro.ok ? emDinheiro.valorLiquido : 0);

          return { mes: m.mes, rotulo: m.rotulo, recebido: soma };
        }),
      );

      return { escolaId: c.escola_id as string, pontos };
    }),
  );

  const total = meses.map((m, i) => ({
    mes: m.mes,
    rotulo: m.rotulo,
    recebido: porEscola.reduce((s, e) => s + (e.pontos[i]?.recebido ?? 0), 0),
  }));

  return { porEscola, total, naoBuscado: null };
}

/**
 * Variação entre o último mês e o anterior.
 *
 * Devolve `null` quando não há dois pontos ou quando o mês anterior foi zero
 * — dividir por zero daria "infinito por cento", que não informa nada. Nesse
 * caso a tela mostra só o valor absoluto.
 */
export function variacaoUltimoMes(pontos: PontoMensal[]) {
  if (pontos.length < 2) return null;
  const atual = pontos[pontos.length - 1].recebido;
  const anterior = pontos[pontos.length - 2].recebido;
  if (anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}
