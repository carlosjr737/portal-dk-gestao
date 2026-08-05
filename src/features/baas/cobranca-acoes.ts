"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { excluirCobranca, obterCobranca } from "@/features/baas/asaas-conta";
import { atualizarCobrancaAsaas } from "@/features/baas/asaas-client";
import { ASAAS_ENV } from "@/features/baas/config";

/**
 * Ações sobre uma cobrança já emitida: editar e excluir.
 *
 * As duas só valem enquanto ninguém pagou. Depois do pagamento o caminho é o
 * estorno, que devolve o dinheiro — editar valor de cobrança paga mentiria
 * sobre o que foi recebido, e apagar deixaria o extrato com uma entrada sem
 * origem.
 *
 * A trava é conferida AQUI e não só na tela. A tela esconde o ícone conforme
 * o status, mas server action é endpoint próprio: quem tiver o id da cobrança
 * chama direto.
 */

export type CobrancaAcaoState = { ok?: boolean; message?: string };

/** Status em que a cobrança ainda não virou dinheiro. */
const EDITAVEL = ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"];

async function autorizar() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    return { erro: "Sem permissão." as const };
  }
  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { erro: "Usuário sem escola vinculada." as const };

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("school_payment_credentials")
    .select("api_key")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  const chave = (cred?.api_key as string | undefined) ?? null;
  if (!chave) return { erro: "Esta escola não tem conta de pagamentos." as const };

  return { chave };
}

function revalidar() {
  revalidatePath("/financeiro/conta");
  revalidatePath("/financeiro/inadimplencia");
  revalidatePath("/financeiro");
}

export async function excluirCobrancaAction(
  _prev: CobrancaAcaoState,
  formData: FormData,
): Promise<CobrancaAcaoState> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, message: auth.erro };

  const paymentId = String(formData.get("payment_id") ?? "");
  if (!paymentId) return { ok: false, message: "Cobrança não identificada." };

  /*
   * Confere o status ANTES de apagar, com o provedor e não com o que a tela
   * mandou. Entre carregar a página e clicar, o responsável pode ter pago —
   * e apagar cobrança paga é o pior desfecho possível desta tela.
   */
  const atual = await obterCobranca(auth.chave, paymentId);
  if (!atual) {
    return { ok: false, message: "Não foi possível conferir a cobrança no provedor." };
  }
  if (!EDITAVEL.includes(atual.status)) {
    return {
      ok: false,
      message:
        "Esta cobrança não está mais em aberto — não dá para excluir. Se precisar desfazer um recebimento, use o estorno.",
    };
  }

  const r = await excluirCobranca(paymentId, auth.chave);
  if (!r.ok) return { ok: false, message: `Não foi possível excluir: ${r.error}` };

  revalidar();
  return { ok: true, message: "Cobrança excluída." };
}

export async function editarCobrancaAction(
  _prev: CobrancaAcaoState,
  formData: FormData,
): Promise<CobrancaAcaoState> {
  const auth = await autorizar();
  if ("erro" in auth) return { ok: false, message: auth.erro };

  const paymentId = String(formData.get("payment_id") ?? "");
  const valor = Number(
    String(formData.get("valor") ?? "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3})/g, "")
      .replace(",", "."),
  );
  const vencimento = String(formData.get("vencimento") ?? "");

  if (!paymentId) return { ok: false, message: "Cobrança não identificada." };
  if (!(valor > 0)) return { ok: false, message: "Informe um valor maior que zero." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
    return { ok: false, message: "Informe uma data de vencimento válida." };
  }

  const atual = await obterCobranca(auth.chave, paymentId);
  if (!atual) {
    return { ok: false, message: "Não foi possível conferir a cobrança no provedor." };
  }
  if (!EDITAVEL.includes(atual.status)) {
    return {
      ok: false,
      message: "Esta cobrança já foi paga — o valor não pode mais mudar.",
    };
  }

  /*
   * `billingType` volta como está. O endpoint de atualização exige o campo, e
   * mandar outra coisa trocaria a forma de pagamento sem ninguém pedir.
   */
  const r = await atualizarCobrancaAsaas(
    paymentId,
    {
      value: valor,
      dueDate: vencimento,
      billingType: atual.formaPagamento,
    },
    auth.chave,
  );
  if (!r.ok) return { ok: false, message: `Não foi possível editar: ${r.error}` };

  revalidar();
  return { ok: true, message: "Cobrança atualizada." };
}
