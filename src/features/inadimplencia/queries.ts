import "server-only";

import { createClient } from "@/lib/supabase/server";
import { competenciaDe } from "@/features/faturamento/queries";

/**
 * Inadimplência com Asaas e sem Asaas, na mesma conta.
 *
 * COM ASAAS o webhook avisa que venceu e ninguém pagou. SEM ASAAS não existe
 * quem avise: o sinal é a AUSÊNCIA de baixa na conciliação depois do
 * vencimento. São dois mecanismos, e por isso cada devedor carrega de onde
 * veio — "atrasado no Asaas" e "sem baixa registrada" pedem ações
 * diferentes, e misturar os dois numa lista só faz a pessoa cobrar quem já
 * pagou.
 *
 * A ARMADILHA QUE ESTA CONSULTA EXISTE PARA EVITAR
 * O DK tem 1 matrícula no Asaas e 664 fora. Se "não pagou" fosse deduzido de
 * "não tem baixa", as 664 apareceriam vermelhas no dia 6 — não porque alguém
 * deixou de pagar, mas porque ninguém marcou. Uma tela que acusa 664 famílias
 * por engano é pior que uma tela vazia: ela some com a credibilidade das
 * outras.
 *
 * Por isso a regra: matrícula sem cobrança acompanhada NÃO é inadimplente. É
 * `naoAcompanhadas`, que aparece com esse nome. Ela só entra na conta de
 * inadimplência a partir do momento em que a competência começou a ser
 * conciliada — aí a ausência de marca passa a significar alguma coisa.
 */

export type OrigemDivida = "asaas" | "sem_baixa";

export type Devedor = {
  enrollmentId: string;
  aluno: string;
  turma: string;
  responsavel: string;
  telefone: string | null;
  valor: number;
  vencimento: string;
  diasDeAtraso: number;
  origem: OrigemDivida;
};

export type InadimplenciaDoMes = {
  competencia: string;
  devedores: Devedor[];
  valorEmAtraso: number;

  /** Matrículas ativas da escola. */
  matriculasAtivas: number;
  /** Com cobrança acompanhada: assinatura no Asaas ou baixa já marcada. */
  acompanhadas: number;
  /**
   * Sem ninguém acompanhando. NÃO são inadimplentes — são invisíveis, e a
   * tela precisa dizer isso com outro nome.
   */
  naoAcompanhadas: number;
  valorNaoAcompanhado: number;

  /**
   * A competência já tem pelo menos uma baixa. Antes disso, ausência de marca
   * não significa nada e a lista de "sem baixa" fica escondida.
   */
  conciliacaoIniciada: boolean;

  /** `true` enquanto `recebimento_01_modelo.sql` não tiver rodado. */
  modeloPendente: boolean;
};

/** Vencimento da competência, a partir do dia da primeira cobrança da matrícula. */
function vencimentoNaCompetencia(
  competencia: string,
  primeiroVencimento: string | null,
): string {
  const dia = primeiroVencimento
    ? Number(primeiroVencimento.slice(8, 10))
    : 5; /* padrão da escola quando a matrícula não tem data */
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const diaValido = Math.min(dia, ultimoDia);
  return `${competencia.slice(0, 7)}-${String(diaValido).padStart(2, "0")}`;
}

export async function getInadimplenciaDoMes(
  competencia = competenciaDe(),
): Promise<InadimplenciaDoMes> {
  const supabase = await createClient();

  const [
    matriculasRes,
    alunosRes,
    turmasRes,
    responsaveisRes,
    recebimentosRes,
    itensRes,
    assinaturasRes,
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "id, student_id, class_id, financial_guardian_id, monthly_amount, discount_amount, first_due_date",
      )
      .eq("status", "active"),
    supabase.from("students").select("id, full_name"),
    supabase.from("classes").select("id, name"),
    supabase.from("guardians").select("id, full_name, phone"),
    supabase
      .from("recebimento_manual")
      .select("enrollment_id")
      .eq("competencia", competencia),
    supabase
      .from("guardian_financial_contract_items")
      .select("enrollment_id, guardian_contract_id"),
    supabase
      .from("aluno_assinatura")
      .select("guardian_contract_id, origem, status, proximo_vencimento, valor"),
  ]);

  const modeloPendente = Boolean(recebimentosRes.error || assinaturasRes.error);

  const alunos = new Map(
    (alunosRes.data ?? []).map((a) => [a.id as string, a.full_name as string]),
  );
  const turmas = new Map(
    (turmasRes.data ?? []).map((c) => [c.id as string, c.name as string]),
  );
  const responsaveis = new Map(
    (responsaveisRes.data ?? []).map((g) => [
      g.id as string,
      { nome: g.full_name as string, telefone: (g.phone as string | null) ?? null },
    ]),
  );

  /*
   * A assinatura é do RESPONSÁVEL — uma cobrança por família — e a matrícula é
   * do aluno. As duas tabelas se encontram aqui e não no PostgREST: não há FK
   * entre item de contrato e assinatura, e pedir o embed derruba a consulta.
   */
  type Assinatura = { status: string; vencimento: string | null };
  const assinaturaPorContrato = new Map<string, Assinatura>();
  for (const a of assinaturasRes.data ?? []) {
    const contrato = a.guardian_contract_id as string | null;
    if (!contrato) continue;
    if ((a.origem as string | null) !== "asaas") continue;
    if ((a.status as string | null) === "cancelada") continue;
    assinaturaPorContrato.set(contrato, {
      status: (a.status as string | null) ?? "pendente",
      vencimento: (a.proximo_vencimento as string | null) ?? null,
    });
  }

  const assinaturaPorMatricula = new Map<string, Assinatura>();
  for (const item of itensRes.data ?? []) {
    const enrollmentId = item.enrollment_id as string | null;
    const contrato = item.guardian_contract_id as string | null;
    if (!enrollmentId || !contrato) continue;
    const a = assinaturaPorContrato.get(contrato);
    if (a) assinaturaPorMatricula.set(enrollmentId, a);
  }

  const jaBaixadas = new Set(
    (recebimentosRes.data ?? []).map((r) => r.enrollment_id as string),
  );
  const conciliacaoIniciada = jaBaixadas.size > 0;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const devedores: Devedor[] = [];
  let valorEmAtraso = 0;
  let acompanhadas = 0;
  let naoAcompanhadas = 0;
  let valorNaoAcompanhado = 0;

  for (const m of matriculasRes.data ?? []) {
    const enrollmentId = m.id as string;
    const valor = Math.max(
      0,
      Number(m.monthly_amount ?? 0) - Number(m.discount_amount ?? 0),
    );
    const vencimento = vencimentoNaCompetencia(
      competencia,
      (m.first_due_date as string | null) ?? null,
    );
    const venceu = new Date(`${vencimento}T00:00:00`) < hoje;
    const diasDeAtraso = venceu
      ? Math.floor(
          (hoje.getTime() - new Date(`${vencimento}T00:00:00`).getTime()) /
            86_400_000,
        )
      : 0;

    const assinatura = assinaturaPorMatricula.get(enrollmentId);
    const baixada = jaBaixadas.has(enrollmentId);

    /*
     * Acompanhada = alguém sabe se esta mensalidade entrou. Ou o Asaas, ou
     * uma pessoa que já marcou a baixa. O resto é território sem informação,
     * e território sem informação não vira acusação.
     */
    const acompanhada = Boolean(assinatura) || baixada || conciliacaoIniciada;
    if (!acompanhada) {
      naoAcompanhadas += 1;
      valorNaoAcompanhado += valor;
      continue;
    }
    acompanhadas += 1;

    if (baixada) continue; // pagou (ou foi marcada como paga)
    if (!venceu) continue; // ainda dentro do prazo

    const guardian = responsaveis.get(
      (m.financial_guardian_id as string | null) ?? "",
    );

    /*
     * A ORIGEM DIZ O QUE FAZER.
     *
     * `asaas`     o provedor confirma que venceu sem pagar — dá para reenviar
     *             a cobrança pela própria tela.
     * `sem_baixa` ninguém marcou. Pode ser que não pagou, pode ser que pagou
     *             e a baixa não foi feita. A ação é conferir, não cobrar.
     */
    const origem: OrigemDivida = assinatura ? "asaas" : "sem_baixa";

    devedores.push({
      enrollmentId,
      aluno: alunos.get(m.student_id as string) ?? "Aluno",
      turma: turmas.get(m.class_id as string) ?? "—",
      responsavel: guardian?.nome ?? "Sem responsável financeiro",
      telefone: guardian?.telefone ?? null,
      valor,
      vencimento,
      diasDeAtraso,
      origem,
    });
    valorEmAtraso += valor;
  }

  devedores.sort((a, b) => b.diasDeAtraso - a.diasDeAtraso);

  return {
    competencia,
    devedores,
    valorEmAtraso,
    matriculasAtivas: matriculasRes.data?.length ?? 0,
    acompanhadas,
    naoAcompanhadas,
    valorNaoAcompanhado,
    conciliacaoIniciada,
    modeloPendente,
  };
}
