"use server";

import { revalidatePath } from "next/cache";
import {
  confirmContaAzulGuardianLink,
  confirmSafeContaAzulGuardianLinks,
  ensureContaAzulCustomerForGuardian,
} from "@/features/finance/conta-azul/guardian-links";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";

export type ContaAzulGuardianLinkActionState = {
  message?: string;
  success?: boolean;
};

export async function confirmContaAzulGuardianLinkAction(formData: FormData) {
  const guardianId = String(formData.get("guardianId") ?? "");
  const contaAzulPersonId = String(formData.get("contaAzulPersonId") ?? "");

  if (!guardianId || !contaAzulPersonId) {
    throw new Error("Vínculo Conta Azul inválido.");
  }

  await confirmContaAzulGuardianLink(guardianId, contaAzulPersonId);
  revalidatePath("/financeiro/vinculos-conta-azul");
  revalidatePath("/financeiro/inadimplencia");
}

export async function ensureContaAzulGuardianLinkAction(
  guardianId: string,
  previousState: ContaAzulGuardianLinkActionState,
  formData: FormData,
): Promise<ContaAzulGuardianLinkActionState> {
  void previousState;
  void formData;

  try {
    const user = await getAuthenticatedUser();
    const profile = user ? await getProfileByUserId(user.id) : null;

    if (!profile?.active || profile.role !== "admin") {
      return {
        success: false,
        message: "Acesso não autorizado.",
      };
    }

    const contaAzulPersonId = await ensureContaAzulCustomerForGuardian(guardianId);

    revalidatePath(`/responsaveis/${guardianId}`);
    revalidatePath("/financeiro/vinculos-conta-azul");
    revalidatePath("/financeiro/inadimplencia");

    return {
      success: true,
      message: `Responsável vinculado ao Conta Azul (${contaAzulPersonId}).`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível vincular o responsável ao Conta Azul.",
    };
  }
}

export async function confirmSafeContaAzulGuardianLinksAction() {
  await confirmSafeContaAzulGuardianLinks();
  revalidatePath("/financeiro/vinculos-conta-azul");
  revalidatePath("/financeiro/inadimplencia");
}
