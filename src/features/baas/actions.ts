"use server";

import { z } from "zod";
import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";
import { criarSubcontaAsaas } from "@/features/baas/asaas-client";
import { ASAAS_ENV } from "@/features/baas/config";

export type CriarSubcontaState = {
  errors?: Record<string, string[]>;
  message?: string;
  ok?: boolean;
  subconta?: { id: string; walletId: string };
};

const subcontaSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da escola."),
  email: z.string().trim().email("E-mail inválido."),
  cpfCnpj: z.string().trim().min(11, "CPF/CNPJ inválido.").transform((v) => v.replace(/\D/g, "")),
  mobilePhone: z.string().trim().min(10, "Telefone inválido.").transform((v) => v.replace(/\D/g, "")),
  incomeValue: z.coerce.number().min(1, "Informe o faturamento mensal."),
  address: z.string().trim().min(1, "Informe a rua."),
  addressNumber: z.string().trim().min(1, "Informe o número."),
  province: z.string().trim().min(1, "Informe o bairro."),
  postalCode: z.string().trim().min(8, "CEP inválido.").transform((v) => v.replace(/\D/g, "")),
  site: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v : undefined))
    .optional(),
});

/**
 * PROTÓTIPO — cria uma subconta real no ambiente SANDBOX do Asaas, só pra
 * gerar evidência funcional pro checklist de BaaS (pergunta 06). Não grava
 * nada no banco do portal (o multi-tenant `escola_id` ainda não existe).
 */
export async function criarSubcontaPreview(
  _prev: CriarSubcontaState,
  formData: FormData,
): Promise<CriarSubcontaState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    return { ok: false, message: "Sem permissão." };
  }

  const parsed = subcontaSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    cpfCnpj: String(formData.get("cpfCnpj") ?? ""),
    mobilePhone: String(formData.get("mobilePhone") ?? ""),
    incomeValue: String(formData.get("incomeValue") ?? ""),
    address: String(formData.get("address") ?? ""),
    addressNumber: String(formData.get("addressNumber") ?? ""),
    province: String(formData.get("province") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    site: String(formData.get("site") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors, message: "Revise os campos." };
  }

  if (ASAAS_ENV !== "sandbox") {
    return { ok: false, message: "Protótipo bloqueado: ASAAS_ENV precisa ser 'sandbox'." };
  }

  const result = await criarSubcontaAsaas(parsed.data);

  if (!result.ok) {
    if (result.error === "asaas_not_configured") {
      return {
        ok: false,
        message: "Configure ASAAS_API_KEY (chave de sandbox) no .env.local do portal.",
      };
    }
    return { ok: false, message: `Asaas recusou: ${result.error}` };
  }

  return {
    ok: true,
    message: "Subconta criada no sandbox do Asaas.",
    subconta: { id: result.id, walletId: result.walletId },
  };
}
