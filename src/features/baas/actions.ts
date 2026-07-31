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
  /** Ecoa o que foi digitado, pra não perder o preenchimento quando dá erro. */
  values?: Record<string, string>;
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
  // Obrigatório para CNPJ (a doc lista como opcional, mas a API recusa sem ele).
  companyType: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"], {
    message: "Selecione o tipo de empresa.",
  }),
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

  const CAMPOS = [
    "name",
    "email",
    "cpfCnpj",
    "mobilePhone",
    "incomeValue",
    "address",
    "addressNumber",
    "province",
    "postalCode",
    "companyType",
    "site",
  ] as const;
  const values = Object.fromEntries(
    CAMPOS.map((c) => [c, String(formData.get(c) ?? "")]),
  ) as Record<string, string>;

  const parsed = subcontaSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos.",
      values,
    };
  }

  if (ASAAS_ENV !== "sandbox") {
    return { ok: false, message: "Protótipo bloqueado: ASAAS_ENV precisa ser 'sandbox'.", values };
  }

  const result = await criarSubcontaAsaas(parsed.data);

  if (!result.ok) {
    if (result.error === "asaas_not_configured") {
      return {
        ok: false,
        message: "Configure ASAAS_API_KEY (chave de sandbox) no .env.local do portal.",
        values,
      };
    }
    return { ok: false, message: `Asaas recusou: ${result.error}`, values };
  }

  return {
    ok: true,
    message: "Subconta criada no sandbox do Asaas.",
    subconta: { id: result.id, walletId: result.walletId },
  };
}
