"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { ASAAS_ENV } from "@/features/baas/config";
import { estornarCobranca } from "@/features/baas/asaas-conta";

/**
 * Só o caminho de ERRO volta por aqui. O sucesso redireciona, porque a
 * confirmação não pode viver num componente que o próprio sucesso remove da
 * tela — ver o comentário no fim desta função.
 */
export type EstornoState = { ok?: boolean; message?: string };

/**
 * Estorna uma cobrança — devolve o dinheiro a quem pagou.
 *
 * ATO IRREVERSÍVEL, e por isso a tela pede confirmação antes de chamar aqui.
 * Não existe "desestornar": para voltar atrás, a escola precisa emitir uma
 * cobrança nova.
 *
 * A TAXA NÃO VOLTA. O provedor não devolve taxa de compensação nem de
 * notificação — estornar uma cobrança de R$ 452,00 custa à escola a diferença
 * entre o bruto e o líquido. A tela diz isso antes de confirmar, com o valor.
 */
export async function estornar(
  _prev: EstornoState,
  formData: FormData,
): Promise<EstornoState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Apenas admin pode estornar uma cobrança." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { ok: false, message: "Usuário sem escola vinculada." };

  const paymentId = String(formData.get("payment_id") ?? "").trim();
  if (!paymentId) return { ok: false, message: "Cobrança não informada." };

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("school_payment_credentials")
    .select("api_key")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  const chave = (cred?.api_key as string | undefined) ?? null;
  if (!chave)
    return { ok: false, message: "Conta de pagamentos não configurada." };

  /*
   * A cobrança é buscada NA CONTA DA ESCOLA, com a chave dela. Isso é o que
   * garante o escopo: um id de outra escola simplesmente não existe aqui, e o
   * provedor responde 404 — não há como estornar cobrança alheia mesmo
   * forjando o formulário.
   */
  const r = await estornarCobranca(
    chave,
    paymentId,
    "Estorno solicitado pela escola",
  );

  if (!r.ok) {
    return { ok: false, message: `O provedor recusou o estorno: ${r.error}` };
  }

  revalidatePath("/financeiro/conta");
  revalidatePath("/financeiro/recebimentos");
  revalidatePath("/financeiro/inadimplencia");

  /*
   * A CONFIRMAÇÃO NÃO PODE MORAR NO BOTÃO.
   *
   * `revalidatePath` re-renderiza a lista, e a cobrança estornada deixa de ser
   * estornável — o botão desaparece, e a mensagem de sucesso desaparece junto
   * com ele. Foi o que aconteceu: o estorno funcionou e a tela não disse nada.
   *
   * Por isso o resultado vai para a URL. Ele sobrevive ao re-render, à
   * atualização da página, e a tela o mostra no topo, longe de qualquer
   * componente que possa sumir.
   */
  redirect(`/financeiro/conta?estornada=${encodeURIComponent(paymentId)}`);
}
