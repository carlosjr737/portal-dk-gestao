"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  enrollmentCancellationReasonSchema,
  enrollmentFormSchema,
} from "@/features/enrollments/schemas";
import {
  cancelEnrollmentGuardianFinancialContractItem,
  syncGuardianFinancialContractToContaAzul,
} from "@/features/finance/guardian-contracts/contracts";
import { ensureGrowthChurnEvent } from "@/features/finance/growth-churn/events";

export type EnrollmentActionState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
};

const cancelEnrollmentSchema = z.object({
  enrollment_id: z.string().uuid("Matrícula inválida."),
  cancellation_reason: enrollmentCancellationReasonSchema,
  cancellation_notes: z.string().trim().nullable(),
}).refine(
  (data) =>
    data.cancellation_reason !== "Outro" ||
    Boolean(data.cancellation_notes?.trim()),
  {
    path: ["cancellation_notes"],
    message: "Informe a observação complementar para o motivo Outro.",
  },
);

function enrollmentFormDataToObject(formData: FormData) {
  return {
    student_id: String(formData.get("student_id") ?? ""),
    class_id: String(formData.get("class_id") ?? ""),
    start_date: String(formData.get("start_date") ?? ""),
    end_date: String(formData.get("end_date") ?? ""),
    first_due_date: String(formData.get("first_due_date") ?? ""),
    status: String(formData.get("status") ?? "active"),
    financial_guardian_id: String(formData.get("financial_guardian_id") ?? ""),
    monthly_amount: String(formData.get("monthly_amount") ?? ""),
    discount_amount: String(formData.get("discount_amount") ?? ""),
    discount_reason: String(formData.get("discount_reason") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createEnrollment(
  _previousState: EnrollmentActionState,
  formData: FormData,
): Promise<EnrollmentActionState> {
  console.log("[REAL CREATE ENROLLMENT ACTION RUNNING]", {
    version: "auto-sync-final-debug-v1",
    timestamp: new Date().toISOString(),
  });

  const parsed = enrollmentFormSchema.safeParse(
    enrollmentFormDataToObject(formData),
  );

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();

  if (parsed.data.status === "active") {
    const { data: existingEnrollment, error: duplicateError } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", parsed.data.student_id)
      .eq("class_id", parsed.data.class_id)
      .eq("status", "active")
      .maybeSingle();

    if (duplicateError) {
      console.error("Enrollment duplicate check error:", duplicateError);
      return {
        message: `Não foi possível validar matrículas existentes: ${duplicateError.message}`,
      };
    }

    if (existingEnrollment) {
      return {
        errors: {
          class_id: ["Este aluno já possui matrícula ativa nesta turma."],
        },
        message: "Este aluno já possui matrícula ativa nesta turma.",
      };
    }
  }

  const { data: guardianLink, error: guardianLinkError } = await supabase
    .from("student_guardians")
    .select("id")
    .eq("student_id", parsed.data.student_id)
    .eq("guardian_id", parsed.data.financial_guardian_id)
    .maybeSingle();

  if (guardianLinkError) {
    console.error("Enrollment guardian link check error:", guardianLinkError);
    return {
      message: `Não foi possível validar o responsável financeiro: ${guardianLinkError.message}`,
    };
  }

  if (!guardianLink) {
    return {
      errors: {
        financial_guardian_id: [
          "Selecione um responsável vinculado ao aluno.",
        ],
      },
      message: "O responsável financeiro precisa estar vinculado ao aluno.",
    };
  }

  const payload = {
    student_id: parsed.data.student_id,
    class_id: parsed.data.class_id,
    status: parsed.data.status,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    first_due_date: parsed.data.first_due_date,
    financial_guardian_id: parsed.data.financial_guardian_id,
    monthly_amount: parsed.data.monthly_amount,
    discount_amount: parsed.data.discount_amount,
    discount_reason: parsed.data.discount_reason,
    notes: parsed.data.notes,
  };

  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .insert(payload)
    .select(
      "id, student_id, class_id, status, financial_guardian_id, monthly_amount, start_date, end_date, first_due_date",
    )
    .single();

  if (error || !enrollment) {
    console.error("Enrollment insert error:", {
      error,
      payload,
    });

    return {
      message: error
        ? `Não foi possível criar a matrícula: ${error.message}`
        : "Não foi possível criar a matrícula.",
    };
  }
  console.log("[ENROLLMENT CREATED]", {
    enrollmentId: enrollment.id,
    financialGuardianId: enrollment.financial_guardian_id,
    monthlyAmount: enrollment.monthly_amount,
    startDate: enrollment.start_date,
    endDate: enrollment.end_date,
    firstDueDate: enrollment.first_due_date,
  });
  console.log("[REAL CREATE ENROLLMENT INSERTED]", {
    enrollmentId: enrollment.id,
  });

  let guardianContractFailed = false;
  let guardianContractLinkNotFound = false;
  let contaAzulAutoSyncSucceeded = false;
  let contaAzulAutoSyncFailed = false;

  if (enrollment.status === "active") {
    await ensureGrowthChurnEvent({
      enrollmentId: enrollment.id as string,
      eventType: "entrada",
      eventDate: (enrollment.start_date as string | null) ?? null,
      source: "enrollment_created",
    });
  }

  const shouldEnsureGuardianContract =
    enrollment.status === "active" &&
    Boolean(enrollment.financial_guardian_id) &&
    Number(enrollment.monthly_amount) > 0 &&
    Boolean(enrollment.start_date) &&
    Boolean(enrollment.end_date) &&
    Boolean(enrollment.first_due_date);

  if (shouldEnsureGuardianContract) {
    console.log("[GUARDIAN CONTRACT RPC] calling", {
      enrollmentId: enrollment.id,
    });

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "ensure_guardian_financial_contract_item",
      {
        p_enrollment_id: enrollment.id,
      },
    );

    console.log("[GUARDIAN CONTRACT RPC] result", {
      enrollmentId: enrollment.id,
      rpcData,
      hasError: Boolean(rpcError),
      errorMessage: rpcError?.message,
    });

    if (rpcError) {
      guardianContractFailed = true;
      console.error("[GUARDIAN CONTRACT RPC] error", {
        enrollmentId: enrollment.id,
        error: rpcError,
      });
    } else {
      const autoSyncResult = await syncEnrollmentGuardianContractAfterRpc(
        enrollment.id as string,
      );

      if (autoSyncResult.status === "synced") {
        contaAzulAutoSyncSucceeded = true;
      } else if (autoSyncResult.status === "contract_link_not_found") {
        guardianContractLinkNotFound = true;
      } else if (autoSyncResult.status === "failed") {
        contaAzulAutoSyncFailed = true;
      }
    }
  }

  revalidatePath("/matriculas");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro/growth-churn");
  revalidatePath(`/alunos/${enrollment.student_id}`);
  revalidatePath(`/turmas/${enrollment.class_id}`);

  const redirectParams = new URLSearchParams();

  redirectParams.set("created", "1");

  if (guardianContractFailed) {
    redirectParams.set("guardianContract", "failed");
  }

  if (guardianContractLinkNotFound) {
    redirectParams.set("guardianContract", "contract_link_not_found");
  }

  if (contaAzulAutoSyncSucceeded) {
    redirectParams.set("guardianContract", "auto_sync_success");
  }

  if (contaAzulAutoSyncFailed) {
    redirectParams.set("guardianContract", "auto_sync_failed");
  }

  const redirectQuery = redirectParams.toString();

  redirect(
    redirectQuery ? `/matriculas?${redirectQuery}` : "/matriculas",
  );
}

async function syncEnrollmentGuardianContractAfterRpc(enrollmentId: string) {
  const adminSupabase = createAdminClient();
  const markerTimestamp = new Date().toISOString();
  const { data: item, error: itemError } = await adminSupabase
    .from("guardian_financial_contract_items")
    .select("id, guardian_contract_id")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  if (itemError) {
    console.error("[ENROLLMENT CONTRACT AUTO SYNC] failed", {
      enrollmentId,
      stage: "load_guardian_contract",
      message: itemError.message,
    });

    return { status: "failed" as const };
  }

  const guardianContractId = item?.guardian_contract_id as string | null;

  if (!guardianContractId) {
    console.error("[AUTO SYNC ERROR] guardianContractId not found after RPC", {
      enrollmentId,
      stage: "load_guardian_contract",
      message:
        "RPC executada, mas nenhum guardian_contract_id foi encontrado para a matrícula.",
    });

    return { status: "contract_link_not_found" as const };
  }

  console.log("[ENROLLMENT CONTRACT AUTO SYNC] contract item found", {
    enrollmentId,
    guardianContractItemId: item?.id,
    guardianContractId,
  });

  const markerPayload = {
    stage: "after_rpc_before_sync",
    enrollmentId,
    guardianContractId,
    timestamp: markerTimestamp,
  };
  const { error: markerError } = await adminSupabase
    .from("guardian_financial_contracts")
    .update({
      status: "pending_sync",
      last_sync_payload: markerPayload,
      updated_at: markerTimestamp,
    })
    .eq("id", guardianContractId);

  if (markerError) {
    console.error("[ENROLLMENT CONTRACT AUTO SYNC] failed", {
      enrollmentId,
      guardianContractId,
      stage: "after_rpc_before_sync",
      message: markerError.message,
    });

    return { status: "failed" as const };
  }

  console.log("[ENROLLMENT CONTRACT AUTO SYNC] marker saved", {
    enrollmentId,
    guardianContractId,
  });

  const { data: guardianContract, error: contractError } = await adminSupabase
    .from("guardian_financial_contracts")
    .select(
      "id, status, provider_contract_id, provider_customer_id, total_amount, start_date, end_date, first_due_date, guardian_id, year",
    )
    .eq("id", guardianContractId)
    .maybeSingle();

  if (contractError || !guardianContract) {
    await markEnrollmentContractAutoSyncFailure({
      guardianContractId,
      enrollmentId,
      stage: "load_guardian_contract",
      message:
        contractError?.message ??
        "Contrato consolidado interno não encontrado após marker.",
    });

    return { status: "failed" as const };
  }

  console.log("[ENROLLMENT CONTRACT AUTO SYNC] providerContractId", {
    enrollmentId,
    guardianContractId,
    providerContractId:
      (guardianContract.provider_contract_id as string | null) ?? null,
  });

  if (guardianContract.provider_contract_id) {
    const reason =
      "Contrato já existe no Conta Azul. Nova matrícula pendente de sincronização.";
    const { error: pendingError } = await adminSupabase
      .from("guardian_financial_contracts")
      .update({
        status: "pending_replacement",
        error_message: null,
        last_sync_payload: {
          stage: "provider_contract_exists",
          message: reason,
          enrollmentId,
          guardianContractId,
          providerContractId: guardianContract.provider_contract_id,
          timestamp: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", guardianContractId);

    if (pendingError) {
      await markEnrollmentContractAutoSyncFailure({
        guardianContractId,
        enrollmentId,
        stage: "load_guardian_contract",
        message: pendingError.message,
      });

      return { status: "failed" as const };
    }

    console.info("[ENROLLMENT CONTRACT AUTO SYNC] markedPendingReplacement");

    return { status: "pending_replacement" as const };
  }

  console.log(
    "[ENROLLMENT CONTRACT AUTO SYNC] calling syncGuardianFinancialContractToContaAzul",
    {
      enrollmentId,
      guardianContractId,
    },
  );

  const syncResult =
    await syncGuardianFinancialContractToContaAzul(guardianContractId);

  if (syncResult.status === "failed") {
    return { status: "failed" as const };
  }

  return { status: "synced" as const };
}

async function markEnrollmentContractAutoSyncFailure({
  guardianContractId,
  enrollmentId,
  stage,
  message,
}: {
  guardianContractId: string;
  enrollmentId: string;
  stage: string;
  message: string;
}) {
  const adminSupabase = createAdminClient();
  const timestamp = new Date().toISOString();
  await adminSupabase
    .from("guardian_financial_contracts")
    .update({
      status: "sync_failed",
      error_message: message,
      last_sync_payload: {
        stage,
        message,
        enrollmentId,
        guardianContractId,
        timestamp,
      },
      updated_at: timestamp,
    })
    .eq("id", guardianContractId);
}

export async function cancelEnrollment(
  _previousState: EnrollmentActionState,
  formData: FormData,
): Promise<EnrollmentActionState> {
  const parsed = cancelEnrollmentSchema.safeParse({
    enrollment_id: String(formData.get("enrollment_id") ?? ""),
    cancellation_reason: String(formData.get("cancellation_reason") ?? ""),
    cancellation_notes:
      String(formData.get("cancellation_notes") ?? "").trim() || null,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os dados do cancelamento.",
    };
  }

  const supabase = await createClient();
  const { data: enrollment, error: loadError } = await supabase
    .from("enrollments")
    .select("id, student_id, class_id, status, monthly_amount")
    .eq("id", parsed.data.enrollment_id)
    .maybeSingle();

  if (loadError || !enrollment) {
    console.error("Cancel enrollment load error:", loadError);
    return {
      message:
        loadError?.message ??
        "Não foi possível localizar a matrícula para cancelamento.",
    };
  }

  if (enrollment.status === "cancelled") {
    return {
      message: "Esta matrícula já está cancelada.",
    };
  }

  if (enrollment.status !== "active") {
    return {
      message: "Apenas matrículas ativas podem ser canceladas.",
    };
  }

  const cancelledAt = new Date().toISOString();
  const { error } = await supabase
    .from("enrollments")
    .update({
      status: "cancelled",
      cancellation_reason: parsed.data.cancellation_reason,
      cancellation_notes: parsed.data.cancellation_notes,
      cancelled_at: cancelledAt,
    })
    .eq("id", parsed.data.enrollment_id);

  if (error) {
    console.error("Cancel enrollment update error:", {
      error,
      enrollmentId: parsed.data.enrollment_id,
    });

    return {
      message: `Não foi possível cancelar a matrícula: ${error.message}`,
    };
  }

  const guardianContractResult =
    await cancelEnrollmentGuardianFinancialContractItem({
      enrollmentId: parsed.data.enrollment_id,
      cancelledAt,
    });

  if (guardianContractResult.status === "failed") {
    console.error("[GUARDIAN CONTRACT] enrollment cancellation failed", {
      enrollmentId: parsed.data.enrollment_id,
      stage: guardianContractResult.stage,
      message: guardianContractResult.message,
    });
  }

  const studentId = enrollment.student_id as string | null;
  const classId = enrollment.class_id as string | null;
  const previousStatus = enrollment.status as string | null;

  // O log usa admin client porque enrollment_logs tem RLS que bloqueia
  // INSERT do usuário autenticado (mesmo padrão das demais escritas internas).
  const { error: logError } = await createAdminClient()
    .from("enrollment_logs")
    .insert({
      enrollment_id: parsed.data.enrollment_id,
      student_id: studentId,
      class_id: classId,
      event_type: "enrollment_cancelled",
      reason: parsed.data.cancellation_reason,
      notes: parsed.data.cancellation_notes,
      previous_status: previousStatus,
      new_status: "cancelled",
      created_at: cancelledAt,
    });

  if (logError) {
    console.error("Cancel enrollment log insert error:", {
      error: logError,
      enrollmentId: parsed.data.enrollment_id,
    });

    return {
      message: `A matrícula foi cancelada, mas não foi possível registrar o log: ${logError.message}`,
    };
  }

  await ensureGrowthChurnEvent({
    enrollmentId: parsed.data.enrollment_id,
    eventType: "saida",
    eventDate: cancelledAt,
    reasonName: parsed.data.cancellation_reason,
    reasonNotes: parsed.data.cancellation_notes,
    source: "enrollment_cancelled",
  });

  revalidatePath("/turmas");
  revalidatePath("/matriculas");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro/growth-churn");
  revalidatePath("/alunos");

  if (studentId) {
    revalidatePath(`/alunos/${studentId}`);
  }

  if (classId) {
    revalidatePath(`/turmas/${classId}`);
  }

  return {
    success: true,
    message: "Matrícula cancelada com sucesso.",
  };
}
