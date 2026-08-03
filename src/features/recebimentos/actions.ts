"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";

export type RecebimentoState = {
  ok?: boolean;
  message?: string;
};

/**
 * Baixa manual de uma cobrança.
 *
 * MARCAR, NÃO DIGITAR. O sistema já sabe quem deve o quê — a tela é uma lista
 * pré-montada onde se marca o que entrou. Por isso esta action recebe a
 * matrícula e a competência, não um lançamento inteiro: valor e vencimento já
 * existem na matrícula. Se isso virar formulário de cadastro, ninguém usa, o
 * dado fica vazio, e o indicador não existe do mesmo jeito.
 */
async function autorizar() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    return { erro: "Sem permissão." as const };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { erro: "Usuário sem escola vinculada." as const };

  return { escolaId, userId: user!.id };
}

function revalidar() {
  revalidatePath("/financeiro/recebimentos");
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/inadimplencia");
}

export async function marcarRecebido(
  _prev: RecebimentoState,
  formData: FormData,
): Promise<RecebimentoState> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, message: auth.erro };

  const enrollmentId = String(formData.get("enrollment_id") ?? "");
  const competencia = String(formData.get("competencia") ?? "");
  const recebidoEm = String(formData.get("recebido_em") ?? "");

  if (!enrollmentId || !competencia || !recebidoEm) {
    return { ok: false, message: "Dados incompletos." };
  }

  const admin = createAdminClient();

  /*
   * `createAdminClient` ignora RLS, então o escopo de escola é conferido à
   * mão. Sem esta checagem, um enrollment_id de outra escola entraria.
   */
  const { data: matricula } = await admin
    .from("enrollments")
    .select("escola_id, monthly_amount, discount_amount, status")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!matricula) return { ok: false, message: "Matrícula não encontrada." };
  if (matricula.escola_id !== auth.escolaId) {
    return { ok: false, message: "Matrícula de outra escola." };
  }

  // Valor padrão vem da matrícula; só é sobrescrito se entrou diferente.
  const padrao = Math.max(
    0,
    Number(matricula.monthly_amount ?? 0) -
      Number(matricula.discount_amount ?? 0),
  );
  const informado = Number(
    String(formData.get("valor") ?? "").replace(",", "."),
  );
  const valor = Number.isFinite(informado) && informado >= 0 ? informado : padrao;

  const { error } = await admin.from("recebimento_manual").upsert(
    {
      escola_id: auth.escolaId,
      enrollment_id: enrollmentId,
      competencia,
      valor,
      recebido_em: recebidoEm,
      created_by: auth.userId,
    },
    { onConflict: "enrollment_id,competencia" },
  );

  if (error) {
    return { ok: false, message: `Não foi possível marcar: ${error.message}` };
  }

  revalidar();
  return { ok: true };
}

/** Desmarcar apaga a linha. O histórico de quem marcou vai junto. */
export async function desmarcarRecebido(
  _prev: RecebimentoState,
  formData: FormData,
): Promise<RecebimentoState> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, message: auth.erro };

  const enrollmentId = String(formData.get("enrollment_id") ?? "");
  const competencia = String(formData.get("competencia") ?? "");
  if (!enrollmentId || !competencia) {
    return { ok: false, message: "Dados incompletos." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("recebimento_manual")
    .delete()
    .eq("enrollment_id", enrollmentId)
    .eq("competencia", competencia)
    .eq("escola_id", auth.escolaId);

  if (error) {
    return { ok: false, message: `Não foi possível desmarcar: ${error.message}` };
  }

  revalidar();
  return { ok: true };
}

/**
 * Marca de uma vez todas as cobranças ainda abertas de um dia de vencimento.
 *
 * Linha do Asaas nunca entra: ela é somente leitura, e o filtro por
 * `first_due_date` roda no servidor para não depender do que a tela mandou.
 */
export async function marcarDiaRecebido(
  _prev: RecebimentoState,
  formData: FormData,
): Promise<RecebimentoState> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, message: auth.erro };

  const competencia = String(formData.get("competencia") ?? "");
  const dia = Number(formData.get("dia") ?? "");
  const recebidoEm = String(formData.get("recebido_em") ?? "");

  if (!competencia || !Number.isFinite(dia) || !recebidoEm) {
    return { ok: false, message: "Dados incompletos." };
  }

  const admin = createAdminClient();

  const [matriculasRes, jaMarcadasRes, itensRes, assinaturasRes] =
    await Promise.all([
      admin
        .from("enrollments")
        .select("id, monthly_amount, discount_amount, first_due_date")
        .eq("escola_id", auth.escolaId)
        .eq("status", "active"),
      admin
        .from("recebimento_manual")
        .select("enrollment_id")
        .eq("escola_id", auth.escolaId)
        .eq("competencia", competencia),
      admin
        .from("guardian_financial_contract_items")
        .select("enrollment_id, guardian_contract_id")
        .eq("escola_id", auth.escolaId),
      admin
        .from("aluno_assinatura")
        .select("guardian_contract_id, origem, status")
        .eq("escola_id", auth.escolaId),
    ]);

  const contratosNoAsaas = new Set(
    (assinaturasRes.data ?? [])
      .filter((a) => a.origem === "asaas" && a.status !== "cancelada")
      .map((a) => a.guardian_contract_id as string),
  );
  const travadas = new Set(
    (itensRes.data ?? [])
      .filter((i) => contratosNoAsaas.has(i.guardian_contract_id as string))
      .map((i) => i.enrollment_id as string),
  );
  const jaMarcadas = new Set(
    (jaMarcadasRes.data ?? []).map((r) => r.enrollment_id as string),
  );

  const alvos = (matriculasRes.data ?? []).filter((m) => {
    const id = m.id as string;
    if (travadas.has(id) || jaMarcadas.has(id)) return false;
    const vencimento = m.first_due_date as string | null;
    return Boolean(vencimento) && Number(vencimento!.slice(8, 10)) === dia;
  });

  if (alvos.length === 0) {
    return { ok: true, message: "Nenhuma cobrança em aberto neste dia." };
  }

  const { error } = await admin.from("recebimento_manual").upsert(
    alvos.map((m) => ({
      escola_id: auth.escolaId,
      enrollment_id: m.id as string,
      competencia,
      valor: Math.max(
        0,
        Number(m.monthly_amount ?? 0) - Number(m.discount_amount ?? 0),
      ),
      recebido_em: recebidoEm,
      created_by: auth.userId,
    })),
    { onConflict: "enrollment_id,competencia" },
  );

  if (error) {
    return { ok: false, message: `Não foi possível marcar: ${error.message}` };
  }

  revalidar();
  return { ok: true, message: `${alvos.length} cobranças marcadas.` };
}
