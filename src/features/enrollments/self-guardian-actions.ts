"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";

export type SelfGuardianResult =
  | { ok: true; guardianId: string; nome: string; criado: boolean }
  | { ok: false; message: string };

/**
 * Rótulo do vínculo quando o próprio aluno banca a mensalidade.
 * Não é exportado: arquivo "use server" só pode exportar funções async.
 */
const RELACAO_PROPRIO_ALUNO = "Próprio aluno";

/**
 * Aluno maior de idade que paga a própria mensalidade.
 *
 * Em vez de deixar a matrícula sem responsável financeiro — o que quebraria
 * contrato, cobrança e a sincronização com o Conta Azul, todos ancorados no
 * responsável —, criamos um `guardian` com os dados do próprio aluno e o
 * vinculamos como responsável financeiro. O contrato então sai naturalmente
 * no nome dele.
 *
 * Idempotente: se o vínculo já existir, apenas o devolve.
 */
export async function tornarAlunoProprioResponsavel(
  studentId: string,
): Promise<SelfGuardianResult> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    return { ok: false, message: "Sem permissão." };
  }

  const supabase = await createClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, full_name, document, phone, email")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return { ok: false, message: "Aluno não encontrado." };
  }

  // Já existe vínculo "próprio aluno"? Então só devolve.
  const { data: existingLinks } = await supabase
    .from("student_guardians")
    .select("guardian_id, relationship, guardians(full_name)")
    .eq("student_id", studentId);

  const jaExiste = (existingLinks ?? []).find(
    (l) => (l.relationship as string | null) === RELACAO_PROPRIO_ALUNO,
  );
  if (jaExiste) {
    return {
      ok: true,
      guardianId: jaExiste.guardian_id as string,
      nome: student.full_name as string,
      criado: false,
    };
  }

  // Mesma pessoa = mesmo cadastro. Se já existe um responsável com o CPF do
  // aluno (ele pode já responder por um irmão, por exemplo), reaproveita —
  // criar outro violaria o índice único de documento.
  let guardianId: string | null = null;
  const documento = (student.document as string | null)?.trim() || null;

  if (documento) {
    const { data: existente } = await supabase
      .from("guardians")
      .select("id")
      .eq("document", documento)
      .maybeSingle();
    if (existente) guardianId = existente.id as string;
  }

  if (!guardianId) {
    const { data: guardian, error: guardianError } = await supabase
      .from("guardians")
      .insert({
        full_name: student.full_name,
        document: documento,
        phone: student.phone,
        email: student.email,
        notes: "Responsável financeiro é o próprio aluno (maior de idade).",
      })
      .select("id")
      .single();

    if (guardianError || !guardian) {
      return {
        ok: false,
        message: `Não foi possível criar o responsável: ${guardianError?.message ?? "erro desconhecido"}`,
      };
    }
    guardianId = guardian.id as string;
  }

  // O vínculo pode já existir com outro rótulo (ex.: aluno já cadastrado como
  // responsável de si mesmo). Nesse caso, só marca como financeiro.
  const vinculoExistente = (existingLinks ?? []).find(
    (l) => (l.guardian_id as string) === guardianId,
  );

  const { error: linkError } = vinculoExistente
    ? await supabase
        .from("student_guardians")
        .update({
          relationship: RELACAO_PROPRIO_ALUNO,
          is_financial_responsible: true,
        })
        .eq("student_id", studentId)
        .eq("guardian_id", guardianId)
    : await supabase.from("student_guardians").insert({
        student_id: studentId,
        guardian_id: guardianId,
        relationship: RELACAO_PROPRIO_ALUNO,
        is_financial_responsible: true,
        is_primary_contact: true,
        is_emergency_contact: false,
        is_primary: true,
      });

  if (linkError) {
    return {
      ok: false,
      message: `Não foi possível vincular o responsável: ${linkError.message}`,
    };
  }

  revalidatePath("/matriculas/nova");
  revalidatePath(`/alunos/${studentId}`);

  return {
    ok: true,
    guardianId,
    nome: student.full_name as string,
    criado: true,
  };
}
