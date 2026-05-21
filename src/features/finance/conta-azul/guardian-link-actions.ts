"use server";

import { revalidatePath } from "next/cache";
import {
  confirmContaAzulGuardianLink,
  confirmSafeContaAzulGuardianLinks,
} from "@/features/finance/conta-azul/guardian-links";

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

export async function confirmSafeContaAzulGuardianLinksAction() {
  await confirmSafeContaAzulGuardianLinks();
  revalidatePath("/financeiro/vinculos-conta-azul");
  revalidatePath("/financeiro/inadimplencia");
}
