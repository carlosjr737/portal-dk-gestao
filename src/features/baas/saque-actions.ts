"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import { ASAAS_ENV } from "@/features/baas/config";
import {
  cancelarSaque,
  consultarChavePix,
  criarSaque,
  type DonoDaChave,
  type TipoChavePix,
} from "@/features/baas/asaas-conta";

export type SaqueState = {
  ok?: boolean;
  message?: string;
  /** Preenchido na etapa de conferência: quem vai receber. */
  destino?: DonoDaChave & { tipo: TipoChavePix; chave: string; valor: number };
  /** Concluído: o saque foi criado. */
  criado?: boolean;
};

const TIPOS: TipoChavePix[] = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"];

function paraNumero(valor: string): number {
  const limpo = valor.replace(/[^\d,.-]/g, "");
  if (!limpo) return NaN;
  return Number(limpo.replace(/\./g, "").replace(",", "."));
}

async function chaveDaEscola() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { erro: "Apenas admin pode sacar." as const };
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
  if (!chave) return { erro: "Conta de pagamentos não configurada." as const };
  return { chave };
}

/**
 * Saque em duas etapas: conferir o destino, depois executar.
 *
 * PIX NÃO TEM VOLTA. Cai na hora e não se desfaz — um dígito trocado na chave
 * manda a mensalidade inteira para um desconhecido, e a escola não tem a quem
 * recorrer. Por isso a primeira etapa não move dinheiro: ela pergunta ao
 * provedor de quem é a chave e devolve o nome do titular para a tela mostrar.
 *
 * A segunda etapa só existe depois que alguém leu aquele nome. É a diferença
 * entre "digitei errado" e "mandei para a pessoa errada".
 */
export async function saqueAction(
  _prev: SaqueState,
  formData: FormData,
): Promise<SaqueState> {
  const auth = await chaveDaEscola();
  if ("erro" in auth) return { ok: false, message: auth.erro };

  const valor = paraNumero(String(formData.get("valor") ?? ""));
  const tipoBruto = String(formData.get("tipo") ?? "");
  const chavePix = String(formData.get("chave") ?? "").trim();
  const confirmando = String(formData.get("confirmar") ?? "") === "1";

  if (!(valor > 0)) return { ok: false, message: "Informe quanto quer sacar." };
  if (!TIPOS.includes(tipoBruto as TipoChavePix)) {
    return { ok: false, message: "Selecione o tipo da chave Pix." };
  }
  if (!chavePix)
    return { ok: false, message: "Informe a chave Pix de destino." };

  const tipo = tipoBruto as TipoChavePix;

  // ── etapa 1: de quem é a chave? ─────────────────────────────────────
  if (!confirmando) {
    const r = await consultarChavePix(auth.chave, tipo, chavePix);
    if (!r.ok) {
      return {
        ok: false,
        message: `Não foi possível conferir esta chave: ${r.error}`,
      };
    }
    return { ok: true, destino: { ...r.dono, tipo, chave: chavePix, valor } };
  }

  // ── etapa 2: executa ────────────────────────────────────────────────
  const r = await criarSaque(auth.chave, { valor, tipo, chavePix });
  if (!r.ok) return { ok: false, message: `O provedor recusou: ${r.error}` };

  revalidatePath("/financeiro/conta");

  /*
   * A mensagem depende de o provedor ter autorizado na hora.
   *
   * Com a validação de saque por webhook habilitada, `authorized` volta true e
   * o dinheiro segue. Sem ela, fica travado esperando uma liberação que não
   * existe por API — e prometer "caiu" nesse caso seria mentira.
   */
  return {
    ok: true,
    criado: true,
    message: r.saque.autorizado
      ? "Saque solicitado. O Pix costuma cair em minutos."
      : "Saque criado, mas o provedor não liberou automaticamente. O valor saiu do saldo e está aguardando — dá para cancelar abaixo.",
  };
}

export async function cancelarSaqueAction(
  _prev: SaqueState,
  formData: FormData,
): Promise<SaqueState> {
  const auth = await chaveDaEscola();
  if ("erro" in auth) return { ok: false, message: auth.erro };

  const id = String(formData.get("saque_id") ?? "").trim();
  if (!id) return { ok: false, message: "Saque não informado." };

  const r = await cancelarSaque(auth.chave, id);
  if (!r.ok)
    return { ok: false, message: `Não foi possível cancelar: ${r.error}` };

  revalidatePath("/financeiro/conta");
  return { ok: true, message: "Saque cancelado. O valor voltou para o saldo." };
}
