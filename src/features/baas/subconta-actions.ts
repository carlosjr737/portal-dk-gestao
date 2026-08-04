"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthenticatedUser,
  getCurrentEscolaId,
  getProfileByUserId,
} from "@/features/auth/session";
import {
  criarSubcontaAsaas,
  registrarWebhookSubconta,
} from "@/features/baas/asaas-client";
import { ASAAS_ENV, getAsaasWebhookToken } from "@/features/baas/config";

export type CriarSubcontaEscolaState = {
  ok?: boolean;
  message?: string;
  /** Campos do cadastro que faltam preencher antes de criar a subconta. */
  faltando?: string[];
};

const OBRIGATORIOS: Array<{ campo: string; label: string }> = [
  { campo: "razao_social", label: "Razão social" },
  { campo: "cnpj", label: "CNPJ" },
  { campo: "email", label: "E-mail" },
  { campo: "telefone", label: "Telefone" },
  { campo: "cep", label: "CEP" },
  { campo: "logradouro", label: "Logradouro" },
  { campo: "numero", label: "Número" },
  { campo: "bairro", label: "Bairro" },
];

/**
 * Cria a subconta de pagamentos da escola a partir do cadastro dela.
 *
 * O que fica onde:
 *   school.asaas_account_id / asaas_wallet_id  -> identificadores, não são segredo
 *   school_payment_credentials.api_key         -> credencial, tabela sem policy
 */
export async function criarSubcontaEscola(
  _prev: CriarSubcontaEscolaState,
  formData: FormData,
): Promise<CriarSubcontaEscolaState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || profile.role !== "admin") {
    return { ok: false, message: "Apenas admin pode criar a conta de pagamentos." };
  }

  const escolaId = await getCurrentEscolaId();
  if (!escolaId) {
    return { ok: false, message: "Seu usuário não está vinculado a uma escola." };
  }

  const faturamento = Number(formData.get("faturamento") ?? 0);
  const tipoEmpresa = String(formData.get("company_type") ?? "");
  if (!["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"].includes(tipoEmpresa)) {
    return { ok: false, message: "Selecione o tipo de empresa." };
  }
  if (!(faturamento > 0)) {
    return { ok: false, message: "Informe o faturamento mensal estimado." };
  }

  const supabase = await createClient();
  const { data: escola } = await supabase
    .from("school")
    .select(
      "nome, razao_social, cnpj, email, telefone, cep, logradouro, numero, complemento, bairro, asaas_account_id",
    )
    .eq("id", escolaId)
    .maybeSingle();

  if (!escola) {
    return { ok: false, message: "Escola não encontrada." };
  }

  /*
   * A trava é por AMBIENTE, não por escola.
   *
   * `school.asaas_account_id` guarda a última conta criada e é único por
   * escola — usá-lo aqui prendia a escola no primeiro ambiente em que ela
   * criou conta. Quem já tem subconta de sandbox precisa poder criar a de
   * produção sem perder a de teste.
   */
  const admin = createAdminClient();
  const { data: credAtual } = await admin
    .from("school_payment_credentials")
    .select("account_id")
    .eq("escola_id", escolaId)
    .eq("environment", ASAAS_ENV)
    .maybeSingle();

  if (credAtual?.account_id) {
    return {
      ok: false,
      message: `Esta escola já tem uma conta de pagamentos em ${
        ASAAS_ENV === "production" ? "produção" : "sandbox"
      }.`,
    };
  }

  // Falha cedo e diz exatamente o que falta, em vez de deixar o Asaas recusar.
  const faltando = OBRIGATORIOS.filter(
    (c) => !String((escola as Record<string, unknown>)[c.campo] ?? "").trim(),
  ).map((c) => c.label);

  if (faltando.length > 0) {
    return {
      ok: false,
      message: "Complete o cadastro da escola antes de criar a conta.",
      faltando,
    };
  }

  const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

  const result = await criarSubcontaAsaas({
    name: (escola.razao_social as string) || (escola.nome as string),
    email: escola.email as string,
    cpfCnpj: soDigitos(escola.cnpj),
    mobilePhone: soDigitos(escola.telefone),
    incomeValue: faturamento,
    address: escola.logradouro as string,
    addressNumber: escola.numero as string,
    complement: (escola.complemento as string | null) ?? undefined,
    province: escola.bairro as string,
    postalCode: soDigitos(escola.cep),
    companyType: tipoEmpresa as "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION",
  });

  if (!result.ok) {
    if (result.error === "asaas_not_configured") {
      return { ok: false, message: "Integração de pagamentos não configurada." };
    }
    return { ok: false, message: `Recusado pelo provedor: ${result.error}` };
  }

  // Identificadores no cadastro da escola (visíveis ao admin). Guardam a
  // ÚLTIMA conta criada — a fonte por ambiente é school_payment_credentials.
  const { error: schoolError } = await admin
    .from("school")
    .update({
      asaas_account_id: result.id,
      asaas_wallet_id: result.walletId,
      kyc_status: "analise",
      // Criar a conta É o opt-in pelo módulo de pagamento.
      usa_pagamentos: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", escolaId);

  if (schoolError) {
    // A subconta existe no provedor mas não conseguimos registrar: avisa com o
    // id em mãos, para não ficar órfã sem ninguém saber.
    console.error("BaaS: subconta criada mas falhou ao gravar em school", {
      escolaId,
      accountId: result.id,
      error: schoolError.message,
    });
    return {
      ok: false,
      message: `Conta criada no provedor (${result.id}), mas falhou ao registrar aqui. Procure o suporte.`,
    };
  }

  // Webhook DENTRO da subconta: sem ele, pagamento de aluno não nos avisa.
  // Falha aqui não desfaz a subconta — dá para registrar depois.
  if (result.apiKey) {
    const token = getAsaasWebhookToken();
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://portal-dk-gestao.vercel.app";
    // Sem token, o webhook seria registrado sem autenticação e TODA entrega
    // levaria 401 do nosso endpoint — silenciosamente, com o webhook
    // aparentando estar saudável. Melhor não registrar e gritar no log.
    if (token) {
      const wh = await registrarWebhookSubconta(
        result.apiKey,
        `${base}/api/webhooks/asaas`,
        token,
      );
      if (!wh.ok) {
        console.error("BaaS: falha ao registrar webhook da subconta", {
          escolaId,
          erro: wh.error,
        });
      }
    } else {
      console.warn("BaaS: ASAAS_WEBHOOK_TOKEN ausente — subconta sem webhook");
    }
  }

  // …e a credencial na tabela sem policy (só o backend lê).
  if (result.apiKey) {
    const { error: credError } = await admin
      .from("school_payment_credentials")
      .upsert(
        {
          escola_id: escolaId,
          provider: "asaas",
          environment: ASAAS_ENV,
          api_key: result.apiKey,
          account_id: result.id,
          wallet_id: result.walletId,
          kyc_status: "analise",
          updated_at: new Date().toISOString(),
        },
        // Por ambiente: criar a conta de produção não sobrescreve a de sandbox.
        { onConflict: "escola_id,environment" },
      );

    if (credError) {
      console.error("BaaS: falha ao guardar credencial da subconta", credError);
    }
  }

  revalidatePath("/configuracoes/escola");
  return {
    ok: true,
    message: `Conta de pagamentos criada (${ASAAS_ENV}). Cadastro enviado para análise.`,
  };
}
