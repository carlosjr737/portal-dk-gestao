"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { ASAAS_ENV } from "@/features/baas/config";
import {
  criarQrCodeEstatico,
  primeiraChavePixAtiva,
} from "@/features/baas/asaas-conta";

export type QrAvulsoState = {
  ok?: boolean;
  message?: string;
  valor?: number;
  descricao?: string;
  payload?: string;
  imagemBase64?: string | null;
};

/**
 * Lê dinheiro escrito em pt-BR.
 *
 * O campo é mascarado e produz `R$ 1.250,00` — com cifrão, ponto de milhar e
 * espaço não-quebrável. Trocar só a vírgula por ponto devolve `NaN` e a tela
 * responde "informe o valor" para um campo visivelmente preenchido.
 */
function paraNumero(valor: string): number {
  const limpo = valor.replace(/[^\d,.-]/g, "");
  if (!limpo) return NaN;
  return Number(limpo.replace(/\./g, "").replace(",", "."));
}

/**
 * Gera um QR Code Pix avulso — cobrança que não é mensalidade.
 *
 * Figurino, taxa de festival, aula avulsa e matrícula não passam por contrato
 * nem por assinatura, e até aqui não tinham por onde ser cobrados dentro do
 * sistema. A secretaria gera, mostra na tela do balcão ou manda por WhatsApp.
 *
 * Nada é gravado no nosso banco: o QR estático vive no provedor e o pagamento
 * entra no extrato pelo caminho normal. Criar tabela para espelhar isso seria
 * manter duas verdades sobre o mesmo dinheiro.
 */
export async function gerarQrAvulso(
  _prev: QrAvulsoState,
  formData: FormData,
): Promise<QrAvulsoState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Sem permissão." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) return { ok: false, message: "Usuário sem escola vinculada." };

  const valor = paraNumero(String(formData.get("valor") ?? ""));
  const descricao = String(formData.get("descricao") ?? "").trim();

  if (!(valor > 0)) {
    return { ok: false, message: "Informe o valor da cobrança.", descricao };
  }
  // A descrição aparece para quem paga e no extrato. Sem ela, a escola recebe
  // um Pix sem saber de quem nem de quê.
  if (!descricao) {
    return {
      ok: false,
      message: "Descreva a cobrança — é o que a família vê ao pagar.",
      valor,
    };
  }

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("school_payment_credentials")
    .select("api_key")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  const chave = (cred?.api_key as string | undefined) ?? null;
  if (!chave) {
    return { ok: false, message: "Esta escola ainda não tem conta de pagamentos." };
  }

  // O QR estático precisa de uma chave Pix explícita — a conta nasce com uma
  // aleatória ativa, mas o provedor recusa a criação sem informá-la.
  const chavePix = await primeiraChavePixAtiva(chave);
  if (!chavePix) {
    return {
      ok: false,
      message:
        "A conta ainda não tem chave Pix ativa. Isso costuma se resolver quando o cadastro é aprovado.",
      valor,
      descricao,
    };
  }

  const r = await criarQrCodeEstatico(chave, {
    addressKey: chavePix,
    valor,
    descricao,
  });

  if (!r.ok) {
    return { ok: false, message: `O provedor recusou: ${r.error}`, valor, descricao };
  }

  return {
    ok: true,
    valor,
    descricao,
    payload: r.qr.payload,
    imagemBase64: r.qr.imagemBase64,
  };
}
