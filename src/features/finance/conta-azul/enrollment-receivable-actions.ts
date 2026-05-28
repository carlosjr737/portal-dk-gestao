"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";
import {
  createContaAzulContractFromGuardianContract,
  replaceGuardianContractOnContaAzul,
} from "@/features/finance/guardian-contracts/contracts";

export async function syncGuardianFinancialContractAction(formData: FormData) {
  const guardianContractId = String(formData.get("guardianContractId") ?? "");
  const mode = String(formData.get("mode") ?? "replace");
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;

  if (!profile?.active || profile.role !== "admin") {
    redirect("/matriculas?contract=unauthorized");
  }

  if (!guardianContractId) {
    redirect("/matriculas?guardianContract=failed");
  }

  let synced = false;

  try {
    if (mode === "create") {
      await createContaAzulContractFromGuardianContract(guardianContractId);
    } else {
      await replaceGuardianContractOnContaAzul(
        guardianContractId,
        "Atualização de matrículas/valores",
      );
    }

    revalidatePath("/matriculas");
    synced = true;
  } catch (error) {
    console.error("[GUARDIAN CONTRACT REPLACE] action failed", {
      guardianContractId,
      message: error instanceof Error ? error.message : error,
    });

    revalidatePath("/matriculas");
  }

  redirect(
    synced
      ? "/matriculas?guardianContract=synced"
      : "/matriculas?guardianContract=failed",
  );
}
