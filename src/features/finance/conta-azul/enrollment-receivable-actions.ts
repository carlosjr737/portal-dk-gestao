"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";
import { createContaAzulContractForEnrollment } from "@/features/finance/conta-azul/enrollment-receivables";

export async function createManualContaAzulContractForEnrollmentAction(
  formData: FormData,
) {
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;

  if (!profile?.active || profile.role !== "admin") {
    redirect("/matriculas?contract=unauthorized");
  }

  if (!enrollmentId) {
    redirect("/matriculas?contract=failed");
  }

  const result = await createContaAzulContractForEnrollment(enrollmentId);

  revalidatePath("/matriculas");

  if (result.status === "contract_created") {
    redirect("/matriculas?contract=created");
  }

  if (result.status === "already_created") {
    redirect("/matriculas?contract=already-created");
  }

  redirect("/matriculas?contract=failed");
}
