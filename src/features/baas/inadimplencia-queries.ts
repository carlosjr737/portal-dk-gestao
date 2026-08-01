import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Devedor = {
  contratoId: string;
  responsavel: string;
  telefone: string | null;
  alunos: string[];
  turmas: string[];
  valor: number;
  vencimento: string;
  diasDeAtraso: number;
};

export type InadimplenciaData = {
  devedores: Devedor[];
  totalEmAtraso: number;
  totalAVencer: number;
  quantidadeEmDia: number;
};

/**
 * Quem está devendo, a partir das cobranças do próprio sistema.
 *
 * Antes esta tela lia do Conta Azul; agora lê de `aluno_assinatura`, que o
 * webhook mantém atualizado. Além de não depender de integração externa, o
 * dado vem com o contrato junto — então dá para agir (mandar a cobrança) na
 * mesma tela, em vez de só olhar a lista.
 *
 * Considera vencido tanto o que o provedor marcou como `atrasada` quanto o
 * que passou do vencimento e ainda consta pendente: o evento de atraso pode
 * demorar a chegar, e o operador não deveria esperar por ele.
 */
export async function getInadimplencia(): Promise<InadimplenciaData> {
  const supabase = await createClient();

  const { data: assinaturas } = await supabase
    .from("aluno_assinatura")
    .select("guardian_contract_id, guardian_id, status, valor, proximo_vencimento")
    .neq("status", "cancelada");

  const linhas = assinaturas ?? [];
  if (linhas.length === 0) {
    return { devedores: [], totalEmAtraso: 0, totalAVencer: 0, quantidadeEmDia: 0 };
  }

  const guardianIds = [...new Set(linhas.map((l) => l.guardian_id as string))];
  const contratoIds = linhas.map((l) => l.guardian_contract_id as string);

  const [{ data: guardians }, { data: itens }] = await Promise.all([
    supabase.from("guardians").select("id, full_name, phone").in("id", guardianIds),
    supabase
      .from("guardian_financial_contract_items")
      .select("guardian_contract_id, enrollment_id")
      .in("guardian_contract_id", contratoIds),
  ]);

  const enrollmentIds = [
    ...new Set((itens ?? []).map((i) => i.enrollment_id as string).filter(Boolean)),
  ];

  const { data: matriculas } = enrollmentIds.length
    ? await supabase
        .from("enrollments")
        .select("id, student_id, class_id")
        .in("id", enrollmentIds)
    : { data: [] as Array<Record<string, unknown>> };

  const studentIds = [
    ...new Set((matriculas ?? []).map((m) => m.student_id as string).filter(Boolean)),
  ];
  const classIds = [
    ...new Set((matriculas ?? []).map((m) => m.class_id as string).filter(Boolean)),
  ];

  const [{ data: alunos }, { data: turmas }] = await Promise.all([
    studentIds.length
      ? supabase.from("students").select("id, full_name").in("id", studentIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    classIds.length
      ? supabase.from("classes").select("id, name").in("id", classIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const nomeAluno = new Map(
    (alunos ?? []).map((a) => [a.id as string, a.full_name as string]),
  );
  const nomeTurma = new Map(
    (turmas ?? []).map((t) => [t.id as string, t.name as string]),
  );
  const matriculaPorId = new Map(
    (matriculas ?? []).map((m) => [m.id as string, m]),
  );
  const guardianPorId = new Map(
    (guardians ?? []).map((g) => [g.id as string, g]),
  );

  // contrato -> nomes de aluno e turma
  const alunosPorContrato = new Map<string, Set<string>>();
  const turmasPorContrato = new Map<string, Set<string>>();
  for (const i of itens ?? []) {
    const cid = i.guardian_contract_id as string;
    const m = matriculaPorId.get(i.enrollment_id as string);
    if (!m) continue;
    const aluno = nomeAluno.get(m.student_id as string);
    const turma = nomeTurma.get(m.class_id as string);
    if (aluno) {
      const s = alunosPorContrato.get(cid) ?? new Set();
      s.add(aluno);
      alunosPorContrato.set(cid, s);
    }
    if (turma) {
      const s = turmasPorContrato.get(cid) ?? new Set();
      s.add(turma);
      turmasPorContrato.set(cid, s);
    }
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const devedores: Devedor[] = [];
  let totalAVencer = 0;
  let quantidadeEmDia = 0;

  for (const l of linhas) {
    const contratoId = l.guardian_contract_id as string;
    const venc = (l.proximo_vencimento as string | null) ?? null;
    const valor = Number(l.valor ?? 0);
    const status = l.status as string;

    const atraso = venc
      ? Math.floor(
          (hoje.getTime() - new Date(`${venc}T00:00:00`).getTime()) / 86_400_000,
        )
      : 0;

    // Vencido pelo provedor OU pela data — o evento de atraso pode demorar.
    const estaDevendo = status === "atrasada" || (status === "pendente" && atraso > 0);

    if (!estaDevendo) {
      if (status === "ativa") quantidadeEmDia += 1;
      totalAVencer += valor;
      continue;
    }

    const g = guardianPorId.get(l.guardian_id as string);
    devedores.push({
      contratoId,
      responsavel: (g?.full_name as string | undefined) ?? "—",
      telefone: (g?.phone as string | null) ?? null,
      alunos: [...(alunosPorContrato.get(contratoId) ?? [])],
      turmas: [...(turmasPorContrato.get(contratoId) ?? [])],
      valor,
      vencimento: venc ?? "",
      diasDeAtraso: Math.max(0, atraso),
    });
  }

  // Mais atrasado primeiro: é por onde a cobrança começa.
  devedores.sort((a, b) => b.diasDeAtraso - a.diasDeAtraso);

  return {
    devedores,
    totalEmAtraso: devedores.reduce((s, d) => s + d.valor, 0),
    totalAVencer,
    quantidadeEmDia,
  };
}
