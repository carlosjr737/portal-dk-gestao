"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";
import { createContaAzulReceivableForEnrollment } from "@/features/finance/conta-azul/enrollment-receivables";

export async function createManualContaAzulReceivableForEnrollmentAction(
  formData: FormData,
) {
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;

  if (!profile?.active || profile.role !== "admin") {
    redirect("/matriculas?receivable=unauthorized");
  }

  if (!enrollmentId) {
    redirect("/matriculas?receivable=failed");
  }

  const result = await createContaAzulReceivableForEnrollment(enrollmentId, {
    mode: "manual",
  });

  revalidatePath("/matriculas");

  if (result.status === "receivable_created") {
    redirect("/matriculas?receivable=created");
  }

  if (result.status === "already_created") {
    redirect("/matriculas?receivable=already-created");
  }

  redirect("/matriculas?receivable=failed");
}
