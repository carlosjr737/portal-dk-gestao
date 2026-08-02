import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  consultarSaldoSubconta,
  estatisticasCobrancas,
} from "@/features/baas/asaas-client";

/**
 * Indicadores das escolas clientes, para o painel do dono da plataforma.
 *
 * O ponto delicado é de onde vem cada número, e vale dizer em voz alta:
 *
 * - Alunos, matrículas e assinatura da plataforma saem do NOSSO banco.
 * - Saldo e faturamento saem do Asaas, consultados com a chave DA ESCOLA.
 *
 * A plataforma não enxerga a movimentação da escola com a própria chave — o
 * desenho de BaaS impede, e é justamente essa separação que faz o dinheiro
 * nunca transitar por aqui. O que existe é a chave da subconta guardada, e
 * com ela se consulta em nome da escola.
 *
 * Uma escola sem chave guardada aparece com os campos financeiros nulos, e a
 * tela diz isso — não zero, que seria mentira.
 */

export type KpiEscola = {
  escolaId: string;
  nome: string;
  /** Do nosso banco. */
  alunosAtivos: number;
  matriculasAtivas: number;
  assinaturaStatus: string | null;
  usaPagamentos: boolean;
  /** Do Asaas, com a chave da escola. `null` = não deu para consultar. */
  saldo: number | null;
  recebidoNoMes: number | null;
  aReceberNoMes: number | null;
  vencidoEmAberto: number | null;
  /** Por que os campos do Asaas vieram nulos, quando vierem. */
  motivoSemDados: string | null;
};

export type KpisPlataforma = {
  escolas: KpiEscola[];
  totais: {
    escolas: number;
    escolasComPagamento: number;
    alunosAtivos: number;
    /** Só soma o que deu para ler; escolas sem dado ficam de fora. */
    recebidoNoMes: number;
    aReceberNoMes: number;
    vencidoEmAberto: number;
    /** Quantas escolas não entraram na soma acima. */
    escolasSemLeitura: number;
  };
  /** MRR da PLATAFORMA — o que as escolas pagam a você, não o que elas faturam. */
  mrrPlataforma: number;
};

function primeiroEUltimoDiaDoMes() {
  const hoje = new Date();
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { de: iso(primeiro), ate: iso(ultimo) };
}

export async function getKpisPlataforma(): Promise<KpisPlataforma> {
  const admin = createAdminClient();
  const { de, ate } = primeiroEUltimoDiaDoMes();

  const [
    { data: escolas },
    { data: alunos },
    { data: matriculas },
    { data: assinaturas },
    { data: credenciais },
  ] = await Promise.all([
    admin
      .from("school")
      .select("id, nome, usa_pagamentos")
      .order("nome", { ascending: true }),
    admin.from("students").select("escola_id").eq("status", "active"),
    admin.from("enrollments").select("escola_id").eq("status", "active"),
    admin
      .from("plataforma_assinatura")
      .select("escola_id, status, valor")
      .neq("status", "cancelada"),
    admin.from("school_payment_credentials").select("escola_id, api_key"),
  ]);

  const contar = (linhas: Array<{ escola_id: unknown }> | null) => {
    const m = new Map<string, number>();
    for (const l of linhas ?? []) {
      const k = l.escola_id as string | null;
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };

  const alunosPor = contar(alunos);
  const matriculasPor = contar(matriculas);
  const assinaturaPor = new Map(
    (assinaturas ?? []).map((a) => [a.escola_id as string, a]),
  );
  const chavePor = new Map(
    (credenciais ?? []).map((c) => [
      c.escola_id as string,
      c.api_key as string | null,
    ]),
  );

  const lista = escolas ?? [];

  // Uma escola por vez seria uma ida ao Asaas por escola em série; em paralelo
  // o painel abre no tempo da mais lenta, não da soma.
  const resultados = await Promise.all(
    lista.map(async (escola): Promise<KpiEscola> => {
      const escolaId = escola.id as string;
      const base = {
        escolaId,
        nome: (escola.nome as string) ?? "Sem nome",
        alunosAtivos: alunosPor.get(escolaId) ?? 0,
        matriculasAtivas: matriculasPor.get(escolaId) ?? 0,
        assinaturaStatus:
          (assinaturaPor.get(escolaId)?.status as string | undefined) ?? null,
        usaPagamentos: Boolean(escola.usa_pagamentos),
      };

      const chave = chavePor.get(escolaId);

      if (!base.usaPagamentos) {
        return {
          ...base,
          saldo: null,
          recebidoNoMes: null,
          aReceberNoMes: null,
          vencidoEmAberto: null,
          motivoSemDados: "Não usa o módulo de pagamentos",
        };
      }

      if (!chave) {
        return {
          ...base,
          saldo: null,
          recebidoNoMes: null,
          aReceberNoMes: null,
          vencidoEmAberto: null,
          motivoSemDados: "Sem conta de pagamentos configurada",
        };
      }

      /*
       * "Recebido" são TRÊS status, não um. Descobri testando contra o
       * sandbox: a subconta tinha R$ 904 recebidos e o filtro por RECEIVED
       * devolvia zero, porque aquele pagamento estava como
       * RECEIVED_IN_CASH — a escola marcou como recebido em dinheiro.
       *
       *   RECEIVED          pago pelo canal do Asaas, dinheiro creditado
       *   CONFIRMED         pago e confirmado, ainda não creditado (cartão)
       *   RECEIVED_IN_CASH  a escola registrou que recebeu por fora
       *
       * Os três são dinheiro que entrou. Somar só o primeiro mostraria um
       * painel financeiro com número menor que a realidade, e o pior tipo de
       * erro num painel é o que parece certo.
       */
      const [saldo, recebido, confirmado, emDinheiro, aReceber, vencido] =
        await Promise.all([
          consultarSaldoSubconta(chave),
          estatisticasCobrancas(chave, {
            status: "RECEIVED",
            vencimentoDe: de,
            vencimentoAte: ate,
          }),
          estatisticasCobrancas(chave, {
            status: "CONFIRMED",
            vencimentoDe: de,
            vencimentoAte: ate,
          }),
          estatisticasCobrancas(chave, {
            status: "RECEIVED_IN_CASH",
            vencimentoDe: de,
            vencimentoAte: ate,
          }),
          estatisticasCobrancas(chave, {
            status: "PENDING",
            vencimentoDe: de,
            vencimentoAte: ate,
          }),
          estatisticasCobrancas(chave, { status: "OVERDUE" }),
        ]);

      // Se qualquer uma falhar, o campo dela vira null e a tela mostra o
      // motivo. Não inventamos zero: zero e "não consegui ler" são coisas
      // diferentes, e confundir as duas faz o dono tomar decisão com número
      // que não existe.
      const erro =
        (!saldo.ok && saldo.error) ||
        (!recebido.ok && recebido.error) ||
        (!confirmado.ok && confirmado.error) ||
        (!emDinheiro.ok && emDinheiro.error) ||
        (!aReceber.ok && aReceber.error) ||
        (!vencido.ok && vencido.error) ||
        null;

      const recebeuTudo = recebido.ok && confirmado.ok && emDinheiro.ok;

      return {
        ...base,
        saldo: saldo.ok ? saldo.saldo : null,
        // Líquido, não bruto: é o que a escola recebe de fato, depois da taxa.
        // (No recebido em dinheiro os dois são iguais — não há taxa do Asaas.)
        recebidoNoMes: recebeuTudo
          ? recebido.valorLiquido +
            confirmado.valorLiquido +
            emDinheiro.valorLiquido
          : null,
        aReceberNoMes: aReceber.ok ? aReceber.valor : null,
        vencidoEmAberto: vencido.ok ? vencido.valor : null,
        motivoSemDados: erro || null,
      };
    }),
  );

  const comLeitura = resultados.filter((e) => e.recebidoNoMes !== null);

  return {
    escolas: resultados,
    totais: {
      escolas: resultados.length,
      escolasComPagamento: resultados.filter((e) => e.usaPagamentos).length,
      alunosAtivos: resultados.reduce((s, e) => s + e.alunosAtivos, 0),
      recebidoNoMes: comLeitura.reduce((s, e) => s + (e.recebidoNoMes ?? 0), 0),
      aReceberNoMes: comLeitura.reduce((s, e) => s + (e.aReceberNoMes ?? 0), 0),
      vencidoEmAberto: comLeitura.reduce(
        (s, e) => s + (e.vencidoEmAberto ?? 0),
        0,
      ),
      escolasSemLeitura: resultados.length - comLeitura.length,
    },
    // O que entra no SEU bolso: a soma das assinaturas ativas da plataforma.
    mrrPlataforma: (assinaturas ?? [])
      .filter((a) => a.status === "ativa")
      .reduce((s, a) => s + Number(a.valor ?? 0), 0),
  };
}
