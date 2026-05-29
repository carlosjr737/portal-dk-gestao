"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";
import { syncGuardianFinancialContractToContaAzul } from "@/features/finance/guardian-contracts/contracts";

export async function syncGuardianContractAction(formData: FormData) {
  const guardianContractId = String(formData.get("guardianContractId") ?? "");
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
    const result =
      await syncGuardianFinancialContractToContaAzul(guardianContractId);

    synced = result.status === "active";
    revalidatePath("/matriculas");
  } catch (error) {
    console.error("[GUARDIAN CONTRACT SYNC] action failed", {
      guardianContractId,
      message: error instanceof Error ? error.message : error,
    });

    revalidatePath("/matriculas");
  }

  redirect(
    synced
      ? "/matriculas?guardianContract=sync_success"
      : "/matriculas?guardianContract=sync_failed",
  );
}

export const syncGuardianFinancialContractAction = syncGuardianContractAction;
