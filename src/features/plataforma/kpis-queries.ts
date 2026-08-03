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
 *
 * DUAS FONTES, DUAS PERGUNTAS DIFERENTES
 * Escola sem o módulo de pagamentos ficava com a coluna financeira inteira
 * vazia, e um painel só de travessões não serve para nada. Então ela passa a
 * mostrar o CONTRATADO — a soma das mensalidades das matrículas ativas.
 *
 * Mas contratado e recebido não são o mesmo número com nomes diferentes:
 *
 *   contratado  o que as famílias se comprometeram a pagar
 *   recebido    o que efetivamente caiu na conta
 *
 * A diferença entre os dois é a inadimplência. Por isso o contratado é
 * calculado para TODA escola, inclusive as que usam o Asaas: sem ele o
 * recebido é um número solto, e ninguém sabe se R$ 200 mil num mês é ótimo
 * ou é metade do esperado.
 *
 * O que a tela nunca faz é somar os dois no mesmo total nem usar o mesmo
 * rótulo para os dois. Escrever "recebido" em cima de um valor contratado
 * mostraria dinheiro que não entrou.
 *
 * O CONTRATADO VEM DA MATRÍCULA, NÃO DE `guardian_financial_contracts`
 * Aquela tabela é o DESTINO da consolidação por família, e hoje está vazia
 * de dado útil — 460 linhas em rascunho, nenhuma ativa, sobra da integração
 * antiga. A matrícula é a origem e tem valor em 100% das linhas.
 */

export type KpiEscola = {
  escolaId: string;
  nome: string;
  /** Do nosso banco. */
  alunosAtivos: number;
  matriculasAtivas: number;
  /**
   * Famílias PAGANTES: responsáveis financeiros distintos com pelo menos uma
   * matrícula ativa. Não é o total de responsáveis cadastrados — irmãos
   * dividem a mesma família, e cadastro antigo sem matrícula não é cliente.
   */
  familias: number;
  /** Matrículas ÷ alunos. Acima de 1 significa aluno em mais de uma turma. */
  matriculasPorAluno: number;
  entradasNoMes: number;
  saidasNoMes: number;
  assinaturaStatus: string | null;
  usaPagamentos: boolean;
  /**
   * Qual número a coluna "no mês" está mostrando. A tela muda o rótulo com
   * isto — é o que impede um valor contratado de aparecer como recebido.
   */
  fonteFinanceira: "asaas" | "contrato";
  /**
   * Soma das mensalidades ativas, já com desconto. Do NOSSO banco, existe
   * para toda escola. É previsão, não caixa.
   */
  contratadoNoMes: number;
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
    matriculasAtivas: number;
    familias: number;
    entradasNoMes: number;
    saidasNoMes: number;
    /** Todas as escolas. Do nosso banco, sempre existe. */
    contratadoNoMes: number;
    /**
     * Só as escolas com Asaas lido. NÃO somar com `contratadoNoMes`: são
     * dinheiro esperado e dinheiro entrado, e a soma dos dois não significa
     * nada.
     */
    recebidoNoMes: number;
    aReceberNoMes: number;
    vencidoEmAberto: number;
    /** Quantas escolas não entraram na soma acima. */
    escolasSemLeitura: number;
    /** Base do "recebido", para a tela dizer sobre quantas escolas ele fala. */
    escolasComLeitura: number;
    /** Contratado apenas das escolas que entraram no "recebido". */
    contratadoDasComLeitura: number;
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
  const inicioDoMes = de;

  const [
    { data: escolas },
    { data: alunos },
    { data: matriculas },
    { data: assinaturas },
    { data: credenciais },
    { data: vinculos },
    { data: eventos },
  ] = await Promise.all([
    admin
      .from("school")
      .select("id, nome, usa_pagamentos")
      .order("nome", { ascending: true }),
    admin.from("students").select("escola_id").eq("status", "active"),
    // Uma consulta só de matrículas serve a três números: quantas são, de
    // quantos alunos distintos, e quanto somam. Buscar as mesmas linhas duas
    // vezes abria espaço para as duas versões discordarem.
    admin
      .from("enrollments")
      .select("student_id, escola_id, monthly_amount, discount_amount")
      .eq("status", "active"),
    admin
      .from("plataforma_assinatura")
      .select("escola_id, status, valor")
      .neq("status", "cancelada"),
    admin.from("school_payment_credentials").select("escola_id, api_key"),
    // Famílias: um vínculo por responsável financeiro de aluno com matrícula
    // ativa. O distinct é feito aqui e não no banco porque o PostgREST não
    // expõe count(distinct); com a ordem de grandeza atual (centenas) sai
    // barato.
    admin
      .from("student_guardians")
      .select("guardian_id, student_id, escola_id")
      .eq("is_financial_responsible", true),
    admin
      .from("growth_churn_events")
      .select("escola_id, event_type, event_date")
      .gte("event_date", inicioDoMes),
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

  /*
   * Contratado do mês: mensalidade menos desconto, por escola.
   *
   * O `Math.max(0, …)` não é paranoia: desconto maior que a mensalidade é
   * erro de digitação que acontece, e sem ele uma linha errada viraria
   * receita NEGATIVA que abate o faturamento das outras — some do total sem
   * deixar rastro. Esta é a mesma definição de receita líquida usada na tela
   * de métricas da escola; as duas precisam bater.
   */
  const contratadoPor = new Map<string, number>();
  for (const m of matriculas ?? []) {
    const escola = m.escola_id as string | null;
    if (!escola) continue;
    const bruto = Number(m.monthly_amount ?? 0);
    const desconto = Number(m.discount_amount ?? 0);
    contratadoPor.set(
      escola,
      (contratadoPor.get(escola) ?? 0) + Math.max(0, bruto - desconto),
    );
  }

  // Famílias pagantes: responsável financeiro DISTINTO cujo aluno tem
  // matrícula ativa. Dois irmãos na escola contam como uma família só — é
  // isso que faz o número dizer "quantas casas pagam", que é o que interessa
  // para o dono, e não "quantas linhas tem a tabela de responsáveis".
  const alunosComMatricula = new Set(
    (matriculas ?? []).map((m) => m.student_id as string),
  );
  const familiasPor = new Map<string, Set<string>>();
  for (const v of vinculos ?? []) {
    const escola = v.escola_id as string | null;
    const guardian = v.guardian_id as string | null;
    const aluno = v.student_id as string | null;
    if (!escola || !guardian || !aluno) continue;
    if (!alunosComMatricula.has(aluno)) continue;
    const atual = familiasPor.get(escola) ?? new Set<string>();
    atual.add(guardian);
    familiasPor.set(escola, atual);
  }

  // Entradas e saídas do mês corrente, pela MESMA fonte que a tela de Growth
  // & Churn do portal usa. Se as duas telas divergirem, uma delas está
  // mentindo — e ninguém saberia qual.
  const entradasPor = new Map<string, number>();
  const saidasPor = new Map<string, number>();
  for (const e of eventos ?? []) {
    const escola = e.escola_id as string | null;
    if (!escola) continue;
    const alvo = e.event_type === "entrada" ? entradasPor : saidasPor;
    alvo.set(escola, (alvo.get(escola) ?? 0) + 1);
  }
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
        familias: familiasPor.get(escolaId)?.size ?? 0,
        matriculasPorAluno:
          (alunosPor.get(escolaId) ?? 0) > 0
            ? (matriculasPor.get(escolaId) ?? 0) / (alunosPor.get(escolaId) ?? 1)
            : 0,
        entradasNoMes: entradasPor.get(escolaId) ?? 0,
        saidasNoMes: saidasPor.get(escolaId) ?? 0,
        assinaturaStatus:
          (assinaturaPor.get(escolaId)?.status as string | undefined) ?? null,
        usaPagamentos: Boolean(escola.usa_pagamentos),
        contratadoNoMes: contratadoPor.get(escolaId) ?? 0,
      };

      const chave = chavePor.get(escolaId);

      /*
       * Sem Asaas, a escola cai para o contratado. Os campos que só existem
       * com meio de pagamento — saldo, vencido, a receber — continuam nulos,
       * e não zero: a escola pode ter inadimplência, o sistema é que não tem
       * como saber. Zero aqui seria afirmar "ninguém deve nada".
       */
      if (!base.usaPagamentos) {
        return {
          ...base,
          fonteFinanceira: "contrato",
          saldo: null,
          recebidoNoMes: null,
          aReceberNoMes: null,
          vencidoEmAberto: null,
          motivoSemDados: "Sem o módulo de pagamentos — valor contratado",
        };
      }

      if (!chave) {
        return {
          ...base,
          fonteFinanceira: "contrato",
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
        /*
         * A leitura pode falhar mesmo com o módulo ligado — chave revogada,
         * Asaas fora do ar. Aí a escola volta para o contratado em vez de
         * ficar sem linha nenhuma, e o motivo aparece do lado do nome.
         */
        fonteFinanceira: recebeuTudo ? "asaas" : "contrato",
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
      matriculasAtivas: resultados.reduce((s, e) => s + e.matriculasAtivas, 0),
      familias: resultados.reduce((s, e) => s + e.familias, 0),
      entradasNoMes: resultados.reduce((s, e) => s + e.entradasNoMes, 0),
      saidasNoMes: resultados.reduce((s, e) => s + e.saidasNoMes, 0),
      contratadoNoMes: resultados.reduce((s, e) => s + e.contratadoNoMes, 0),
      recebidoNoMes: comLeitura.reduce((s, e) => s + (e.recebidoNoMes ?? 0), 0),
      aReceberNoMes: comLeitura.reduce((s, e) => s + (e.aReceberNoMes ?? 0), 0),
      vencidoEmAberto: comLeitura.reduce(
        (s, e) => s + (e.vencidoEmAberto ?? 0),
        0,
      ),
      escolasSemLeitura: resultados.length - comLeitura.length,
      escolasComLeitura: comLeitura.length,
      // O contratado DESTAS escolas, para comparar com o recebido delas. Usar
      // o contratado geral daria uma inadimplência inventada, cheia de escola
      // que nem tem cobrança no Asaas.
      contratadoDasComLeitura: comLeitura.reduce(
        (s, e) => s + e.contratadoNoMes,
        0,
      ),
    },
    // O que entra no SEU bolso: a soma das assinaturas ativas da plataforma.
    mrrPlataforma: (assinaturas ?? [])
      .filter((a) => a.status === "ativa")
      .reduce((s, a) => s + Number(a.valor ?? 0), 0),
  };
}
