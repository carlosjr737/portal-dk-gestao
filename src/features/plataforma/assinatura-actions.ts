"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/features/plataforma/auth";
import {
  criarAssinaturaAsaas,
  criarClienteAsaas,
} from "@/features/baas/asaas-client";

export type AssinaturaState = {
  ok?: boolean;
  message?: string;
  faltando?: string[];
};

/** Primeiro vencimento: daqui a N dias, para a escola ter prazo de pagar. */
const DIAS_ATE_PRIMEIRO_VENCIMENTO = 7;

function dataEmDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Cria a assinatura do SaaS para uma escola (Fluxo 2).
 *
 * Cobrada na conta da PLATAFORMA — nada a ver com a subconta da escola nem
 * com o split do Fluxo 1. Por isso usa a chave da plataforma (env).
 */
export async function criarAssinaturaEscola(
  _prev: AssinaturaState,
  formData: FormData,
): Promise<AssinaturaState> {
  if (!(await isPlatformOwner())) {
    return { ok: false, message: "Apenas o operador da plataforma pode fazer isso." };
  }

  const escolaId = String(formData.get("escola_id") ?? "");
  const planoId = String(formData.get("plano_id") ?? "");
  const billingType = String(formData.get("billing_type") ?? "PIX");

  if (!escolaId || !planoId) {
    return { ok: false, message: "Selecione a escola e o plano." };
  }

  const admin = createAdminClient();

  const [{ data: escola }, { data: plano }, { data: jaExiste }] = await Promise.all([
    admin
      .from("school")
      .select("id, nome, razao_social, cnpj, email, telefone, cep, logradouro, numero, bairro")
      .eq("id", escolaId)
      .maybeSingle(),
    admin
      .from("plataforma_plano")
      .select("id, nome, periodicidade, valor")
      .eq("id", planoId)
      .maybeSingle(),
    admin
      .from("plataforma_assinatura")
      .select("id")
      .eq("escola_id", escolaId)
      .maybeSingle(),
  ]);

  if (!escola) return { ok: false, message: "Escola não encontrada." };
  if (!plano) return { ok: false, message: "Plano não encontrado." };
  if (jaExiste) {
    return { ok: false, message: "Esta escola já tem assinatura. Cancele a atual antes." };
  }

  // Falha cedo, dizendo o que falta — em vez de deixar o provedor recusar.
  const obrigatorios: Array<[string, string]> = [
    ["cnpj", "CNPJ"],
    ["email", "E-mail"],
  ];
  const faltando = obrigatorios
    .filter(([campo]) => !String((escola as Record<string, unknown>)[campo] ?? "").trim())
    .map(([, label]) => label);

  if (faltando.length > 0) {
    return {
      ok: false,
      message: "Complete o cadastro da escola antes de criar a assinatura.",
      faltando,
    };
  }

  const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

  const cliente = await criarClienteAsaas({
    name: (escola.razao_social as string) || (escola.nome as string),
    cpfCnpj: soDigitos(escola.cnpj),
    email: (escola.email as string | null) ?? undefined,
    mobilePhone: soDigitos(escola.telefone) || undefined,
    postalCode: soDigitos(escola.cep) || undefined,
    address: (escola.logradouro as string | null) ?? undefined,
    addressNumber: (escola.numero as string | null) ?? undefined,
    province: (escola.bairro as string | null) ?? undefined,
    externalReference: escolaId,
  });

  if (!cliente.ok) {
    return { ok: false, message: `Não foi possível cadastrar a escola como cliente: ${cliente.error}` };
  }

  const periodicidade = plano.periodicidade as string;
  const proximoVencimento = dataEmDias(DIAS_ATE_PRIMEIRO_VENCIMENTO);

  const assinatura = await criarAssinaturaAsaas({
    customer: cliente.id,
    value: Number(plano.valor),
    nextDueDate: proximoVencimento,
    cycle: periodicidade === "anual" ? "YEARLY" : "MONTHLY",
    billingType: billingType as "PIX" | "BOLETO" | "CREDIT_CARD",
    description: `Assinatura ${plano.nome} — sistema de gestão`,
    externalReference: escolaId,
  });

  if (!assinatura.ok) {
    return { ok: false, message: `Não foi possível criar a assinatura: ${assinatura.error}` };
  }

  const { error } = await admin.from("plataforma_assinatura").insert({
    escola_id: escolaId,
    plano_id: planoId,
    asaas_customer_id: cliente.id,
    asaas_subscription_id: assinatura.id,
    status: "pendente",
    valor: Number(plano.valor),
    proximo_vencimento: assinatura.nextDueDate,
  });

  if (error) {
    console.error("Plataforma: assinatura criada no provedor mas não registrada", {
      escolaId,
      subscriptionId: assinatura.id,
      error: error.message,
    });
    return {
      ok: false,
      message: `Assinatura criada no provedor (${assinatura.id}), mas falhou ao registrar aqui.`,
    };
  }

  revalidatePath("/plataforma");
  return {
    ok: true,
    message: `Assinatura ${plano.nome} criada. Primeiro vencimento em ${assinatura.nextDueDate.split("-").reverse().join("/")}.`,
  };
}
