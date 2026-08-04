import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEscolaId } from "@/features/auth/session";
import { listarCobrancasAssinatura } from "@/features/baas/asaas-client";
import { ASAAS_ENV } from "@/features/baas/config";
import type {
  ContratoDoAluno,
  LinhaMensalidade,
  MensalidadesDoAluno,
  StatusMensalidade,
} from "@/features/mensalidades/types";

/**
 * Quantos meses para trás a tabela mostra no canal manual.
 *
 * Sem teto, uma matrícula de 2023 renderia 30 linhas projetadas que ninguém
 * vai dar baixa — e a linha do mês atual, que é a acionável, sumiria no meio.
 */
const MESES_PROJETADOS = 12;

const VAZIO: MensalidadesDoAluno = {
  usaPagamentos: false,
  linhas: [],
  contratos: [],
  mensalidadeAtual: 0,
  emAberto: 0,
  valorEmAberto: 0,
  avisoProvedor: null,
};

/** Status do provedor traduzido para os cinco que a tela sabe pintar. */
function statusDoProvedor(status: string): StatusMensalidade {
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(status)) {
    return "pago";
  }
  if (status === "OVERDUE") return "atrasado";
  if (["REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "REFUND_REQUESTED"].includes(status)) {
    return "estornado";
  }
  if (["DELETED", "REFUND_IN_PROGRESS"].includes(status)) return "cancelado";
  return "pendente";
}

function competenciaDaData(data: string) {
  return `${data.slice(0, 7)}-01`;
}

/**
 * O vencimento do mês a partir do dia cadastrado na matrícula.
 *
 * Fevereiro não tem dia 31: o dia é limitado ao último do mês em vez de
 * transbordar para março, que é o que `new Date(ano, mes, 31)` faria. Mesma
 * regra de `features/recebimentos/queries.ts` — se um dia divergirem, a mesma
 * cobrança aparece em dois dias diferentes em duas telas.
 */
function vencimentoNaCompetencia(competencia: string, dia: number) {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${competencia.slice(0, 7)}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

/** Lista de competências entre dois meses, da mais antiga para a mais nova. */
function competenciasEntre(inicio: string, fim: string) {
  const meses: string[] = [];
  const [anoI, mesI] = inicio.split("-").map(Number);
  const [anoF, mesF] = fim.split("-").map(Number);
  let ano = anoI;
  let mes = mesI;

  while (ano < anoF || (ano === anoF && mes <= mesF)) {
    meses.push(`${ano}-${String(mes).padStart(2, "0")}-01`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    // Trava de segurança: data inválida no cadastro não pode virar laço
    // infinito num componente de servidor.
    if (meses.length > 240) break;
  }

  return meses;
}

export async function getMensalidadesDoAluno(
  studentId: string,
): Promise<MensalidadesDoAluno> {
  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return VAZIO;

  const supabase = await createClient();

  const [{ data: escola }, { data: matriculas }] = await Promise.all([
    supabase.from("school").select("usa_pagamentos").eq("id", escolaId).maybeSingle(),
    supabase
      .from("enrollments")
      .select(
        "id, class_id, status, start_date, end_date, first_due_date, monthly_amount, discount_amount, cancelled_at",
      )
      .eq("student_id", studentId),
  ]);

  const usaPagamentos = Boolean(escola?.usa_pagamentos);
  if (!usaPagamentos) return VAZIO;

  const enrollmentIds = (matriculas ?? []).map((m) => m.id as string);
  if (enrollmentIds.length === 0) {
    return { ...VAZIO, usaPagamentos: true };
  }

  const [{ data: turmas }, { data: itensDoAluno }, { data: recebimentos }] =
    await Promise.all([
      supabase.from("classes").select("id, name"),
      supabase
        .from("guardian_financial_contract_items")
        .select("enrollment_id, guardian_contract_id")
        .in("enrollment_id", enrollmentIds),
      supabase
        .from("recebimento_manual")
        .select("enrollment_id, competencia, valor, recebido_em")
        .in("enrollment_id", enrollmentIds),
    ]);

  const contratoPorMatricula = new Map<string, string>();
  for (const item of itensDoAluno ?? []) {
    const e = item.enrollment_id as string | null;
    const c = item.guardian_contract_id as string | null;
    if (e && c) contratoPorMatricula.set(e, c);
  }
  const contratoIds = [...new Set(contratoPorMatricula.values())];

  const [
    { data: contratos },
    { data: assinaturas },
    { data: itensDosContratos },
  ] = await Promise.all([
    contratoIds.length
      ? supabase
          .from("guardian_financial_contracts")
          .select("id, guardian_id, total_amount, status")
          .in("id", contratoIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    contratoIds.length
      ? supabase
          .from("aluno_assinatura")
          .select(
            "guardian_contract_id, asaas_subscription_id, status, origem, valor",
          )
          .in("guardian_contract_id", contratoIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    // Itens de TODOS os contratos envolvidos, não só os do aluno: é assim que
    // se descobre que a cobrança é compartilhada com um irmão.
    contratoIds.length
      ? supabase
          .from("guardian_financial_contract_items")
          .select("guardian_contract_id, student_id")
          .in("guardian_contract_id", contratoIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const guardianIds = [
    ...new Set(
      (contratos ?? [])
        .map((c) => c.guardian_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const irmaosIds = [
    ...new Set(
      (itensDosContratos ?? [])
        .map((i) => i.student_id as string | null)
        .filter((id): id is string => Boolean(id) && id !== studentId),
    ),
  ];

  const [{ data: responsaveis }, { data: irmaos }] = await Promise.all([
    guardianIds.length
      ? supabase.from("guardians").select("id, full_name").in("id", guardianIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    irmaosIds.length
      ? supabase.from("students").select("id, full_name").in("id", irmaosIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const nomeTurma = new Map(
    (turmas ?? []).map((t) => [t.id as string, t.name as string]),
  );
  const nomeResponsavel = new Map(
    (responsaveis ?? []).map((g) => [g.id as string, g.full_name as string]),
  );
  const nomeIrmao = new Map(
    (irmaos ?? []).map((s) => [s.id as string, s.full_name as string]),
  );

  /*
   * Assinatura viva é a que ainda cobra. A cancelada fica no banco de
   * propósito — é o histórico de que já houve cobrança —, mas não pode fazer a
   * matrícula parecer coberta hoje.
   */
  type Assinatura = { subscriptionId: string; status: string };
  const assinaturaPorContrato = new Map<string, Assinatura>();
  for (const a of assinaturas ?? []) {
    if ((a.origem as string) !== "asaas") continue;
    if ((a.status as string) === "cancelada") continue;
    const contrato = a.guardian_contract_id as string | null;
    const subscriptionId = a.asaas_subscription_id as string | null;
    if (!contrato || !subscriptionId) continue;
    assinaturaPorContrato.set(contrato, {
      subscriptionId,
      status: (a.status as string) ?? "pendente",
    });
  }

  const alunosPorContrato = new Map<string, Set<string>>();
  for (const item of itensDosContratos ?? []) {
    const contrato = item.guardian_contract_id as string;
    const aluno = item.student_id as string | null;
    if (!contrato || !aluno || aluno === studentId) continue;
    const set = alunosPorContrato.get(contrato) ?? new Set<string>();
    set.add(aluno);
    alunosPorContrato.set(contrato, set);
  }

  const contratosDoAluno: ContratoDoAluno[] = (contratos ?? []).map((c) => {
    const id = c.id as string;
    const assinatura = assinaturaPorContrato.get(id);
    return {
      contratoId: id,
      responsavelId: (c.guardian_id as string) ?? "",
      responsavelNome:
        nomeResponsavel.get(c.guardian_id as string) ?? "Responsável",
      valorTotal: Number(c.total_amount ?? 0),
      temAssinatura: Boolean(assinatura),
      statusAssinatura: assinatura?.status ?? null,
      outrosAlunos: [...(alunosPorContrato.get(id) ?? [])].map(
        (alunoId) => nomeIrmao.get(alunoId) ?? "Outro aluno",
      ),
    };
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const linhas: LinhaMensalidade[] = [];
  let avisoProvedor: string | null = null;

  // ---------------------------------------------------------------------
  // Canal Asaas: as parcelas vêm do provedor. Ele é a verdade.
  // ---------------------------------------------------------------------
  const contratosNoAsaas = contratosDoAluno.filter((c) => c.temAssinatura);

  if (contratosNoAsaas.length > 0) {
    /*
     * A chave da SUBCONTA sai por `createAdminClient` porque
     * `school_payment_credentials` não é leitura de usuário — nem deveria ser.
     * O escopo de escola já foi resolvido em `getCurrentEscolaId`.
     */
    const admin = createAdminClient();
    const { data: cred } = await admin
      .from("school_payment_credentials")
      .select("api_key")
      .eq("escola_id", escolaId)
      .eq("environment", ASAAS_ENV)
      .maybeSingle();

    const apiKey = (cred?.api_key as string | undefined) ?? null;

    if (!apiKey) {
      avisoProvedor =
        "A conta de pagamentos não está configurada neste ambiente — as parcelas do provedor não foram carregadas.";
    } else {
      for (const contrato of contratosNoAsaas) {
        const assinatura = assinaturaPorContrato.get(contrato.contratoId);
        if (!assinatura) continue;

        const r = await listarCobrancasAssinatura(
          assinatura.subscriptionId,
          apiKey,
        );

        if (!r.ok) {
          // Falha de leitura vira aviso, não tela vazia: "nenhuma mensalidade"
          // e "não consegui perguntar" são coisas bem diferentes para quem
          // está cobrando.
          avisoProvedor = `Não foi possível ler as parcelas no provedor: ${r.error}`;
          continue;
        }

        for (const cobranca of r.cobrancas) {
          linhas.push({
            id: cobranca.id,
            competencia: competenciaDaData(cobranca.dueDate),
            vencimento: cobranca.dueDate || null,
            recebimento: cobranca.paymentDate,
            valor: cobranca.value,
            valorRecebido: cobranca.paymentDate ? cobranca.value : null,
            status: statusDoProvedor(cobranca.status),
            canal: "asaas",
            referencia: `Contrato · ${contrato.responsavelNome}`,
            paymentId: cobranca.id,
            billingType: cobranca.billingType || null,
            invoiceUrl: cobranca.invoiceUrl,
            enrollmentId: null,
            travada: true,
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // Canal manual: os meses são projetados da matrícula e cruzados com o que
  // já foi marcado como recebido.
  // ---------------------------------------------------------------------
  const baixaPorChave = new Map<string, { valor: number; recebidoEm: string }>();
  for (const r of recebimentos ?? []) {
    const chave = `${r.enrollment_id as string}|${competenciaDaData(String(r.competencia))}`;
    baixaPorChave.set(chave, {
      valor: Number(r.valor ?? 0),
      recebidoEm: String(r.recebido_em),
    });
  }

  let mensalidadeAtual = 0;

  for (const m of matriculas ?? []) {
    const enrollmentId = m.id as string;
    const contratoId = contratoPorMatricula.get(enrollmentId) ?? null;
    const noAsaas = contratoId ? assinaturaPorContrato.has(contratoId) : false;

    const valor = Math.max(
      0,
      Number(m.monthly_amount ?? 0) - Number(m.discount_amount ?? 0),
    );
    if ((m.status as string) === "active") mensalidadeAtual += valor;

    // Matrícula coberta pelo provedor não ganha linha projetada: ela já
    // aparece na parcela do contrato, e duplicar aqui contaria o mesmo mês
    // duas vezes na soma do que está em aberto.
    if (noAsaas) continue;

    const primeiroVencimento = (m.first_due_date as string | null) ?? null;
    if (!primeiroVencimento) continue;

    const dia = Number(primeiroVencimento.slice(8, 10));
    if (!Number.isFinite(dia) || dia < 1) continue;

    /*
     * O fim da projeção é o que vier primeiro: hoje, a data final da
     * matrícula ou o cancelamento. Projetar além disso inventaria dívida de
     * quem já saiu — e é exatamente esse tipo de linha que faz a secretaria
     * perder a confiança na tela.
     */
    const fins = [
      hoje,
      (m.end_date as string | null) ?? null,
      (m.cancelled_at as string | null)?.slice(0, 10) ?? null,
    ].filter((d): d is string => Boolean(d));
    const fim = fins.sort()[0];

    const inicio = primeiroVencimento.slice(0, 7) + "-01";
    if (inicio > fim) continue;

    const meses = competenciasEntre(inicio, fim.slice(0, 7) + "-01").slice(
      -MESES_PROJETADOS,
    );

    const turma = nomeTurma.get(m.class_id as string) ?? "Turma";

    for (const competencia of meses) {
      const vencimento = vencimentoNaCompetencia(competencia, dia);
      const baixa = baixaPorChave.get(`${enrollmentId}|${competencia}`);
      const status: StatusMensalidade = baixa
        ? "pago"
        : vencimento < hoje
          ? "atrasado"
          : "pendente";

      linhas.push({
        id: `${enrollmentId}-${competencia}`,
        competencia,
        vencimento,
        recebimento: baixa?.recebidoEm ?? null,
        valor,
        valorRecebido: baixa?.valor ?? null,
        status,
        canal: "manual",
        referencia: turma,
        paymentId: null,
        billingType: null,
        invoiceUrl: null,
        enrollmentId,
        travada: false,
      });
    }
  }

  // Mais recente primeiro: o mês que a secretaria precisa resolver está no
  // topo, não no fim de uma rolagem de doze meses.
  linhas.sort(
    (a, b) =>
      (b.vencimento ?? "").localeCompare(a.vencimento ?? "") ||
      a.referencia.localeCompare(b.referencia, "pt-BR"),
  );

  const abertas = linhas.filter(
    (l) => l.status === "pendente" || l.status === "atrasado",
  );

  return {
    usaPagamentos: true,
    linhas,
    contratos: contratosDoAluno,
    mensalidadeAtual,
    emAberto: abertas.length,
    valorEmAberto: abertas.reduce((soma, l) => soma + l.valor, 0),
    avisoProvedor,
  };
}
