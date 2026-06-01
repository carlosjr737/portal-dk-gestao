import "server-only";

import {
  ContaAzulApiError,
  ContaAzulClient,
  getContaAzulResponseDiagnostics,
} from "@/features/finance/conta-azul/client";
import { ensureContaAzulCustomerForGuardian } from "@/features/finance/conta-azul/guardian-links";
import { createAdminClient } from "@/lib/supabase/admin";

const CONTA_AZUL_PROVIDER = "conta_azul";

type GuardianFinancialContractDraftInput = {
  guardianId: string;
  provider?: "conta_azul";
  providerCustomerId?: string | null;
  year: number;
  startDate: string;
  endDate: string;
  firstDueDate: string;
};

type EnrollmentSnapshot = {
  id: string;
  student_id: string | null;
  class_id: string | null;
  financial_guardian_id: string | null;
  monthly_amount: number | string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  first_due_date: string | null;
};

type GuardianFinancialContract = {
  id: string;
  guardian_id: string;
  provider: "conta_azul";
  provider_customer_id: string | null;
  provider_contract_id: string | null;
  provider_legacy_id: string | null;
  provider_sale_id?: string | null;
  year: number;
  version: number | null;
  status: string;
  total_amount: number | string;
  start_date: string;
  end_date: string;
  first_due_date: string;
  contract_payload?: unknown;
  last_sync_payload?: unknown;
};

type GuardianContractItem = {
  id: string;
  enrollment_id: string;
  student_id: string | null;
  class_id: string | null;
  description: string;
  amount: number | string;
  status: string;
  started_at: string;
  ended_at: string;
};

type FinanceProviderSettings = {
  active: boolean | null;
  conta_azul_financial_account_id: string | null;
  conta_azul_revenue_category_id: string | null;
  conta_azul_service_item_id: string | null;
  default_due_day: number | null;
};

type NamedRecord = {
  id: string;
  full_name?: string | null;
  name?: string | null;
};

type GuardianRecord = {
  id: string;
  full_name: string | null;
  conta_azul_person_id: string | null;
};

type AddEnrollmentToGuardianContractResult =
  | {
      status: "created";
      guardianContractId: string;
      totalAmount: number;
      itemId: string | null;
    }
  | {
      status: "warning";
      enrollmentId: string;
      guardianContractId: string | null;
      stage: string;
      message: string;
      details: ReturnType<typeof buildFailurePayload>;
    };

type CancelEnrollmentGuardianContractItemResult =
  | {
      status: "updated";
      enrollmentId: string;
      guardianContractId: string;
      itemId: string;
      totalAmount: number;
      contractStatus: "draft" | "pending_replacement";
    }
  | {
      status: "skipped";
      enrollmentId: string;
      reason: string;
    }
  | {
      status: "failed";
      enrollmentId: string;
      stage: string;
      message: string;
    };

type AutoSyncGuardianContractResult =
  | {
      status: "created";
      guardianContractId: string;
      providerContractId: string;
    }
  | {
      status: "pending_replacement";
      guardianContractId: string;
    }
  | {
      status: "skipped";
      enrollmentId: string;
      reason: string;
    }
  | {
      status: "failed";
      guardianContractId: string | null;
      stage: string;
      message: string;
    };

class GuardianContractSyncError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "GuardianContractSyncError";
  }
}

export async function getOrCreateGuardianFinancialContractDraft(
  input: GuardianFinancialContractDraftInput,
) {
  const supabase = createAdminClient();
  const provider = input.provider ?? CONTA_AZUL_PROVIDER;

  const { data: existingContract, error: existingError } = await supabase
    .from("guardian_financial_contracts")
    .select(buildGuardianContractSelect())
    .eq("guardian_id", input.guardianId)
    .eq("provider", provider)
    .eq("year", input.year)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingContract) {
    console.info("[GUARDIAN CONTRACT] contractFound", true);
    console.info("[GUARDIAN CONTRACT] contractCreated", null);

    return existingContract as unknown as GuardianFinancialContract;
  }

  const { data: createdContract, error: createError } = await supabase
    .from("guardian_financial_contracts")
    .insert({
      guardian_id: input.guardianId,
      provider,
      ...(input.providerCustomerId
        ? { provider_customer_id: input.providerCustomerId }
        : {}),
      year: input.year,
      version: 1,
      status: "draft",
      total_amount: 0,
      start_date: input.startDate,
      end_date: input.endDate,
      first_due_date: input.firstDueDate,
      effective_from: input.startDate,
    })
    .select(buildGuardianContractSelect())
    .single();

  if (createError || !createdContract) {
    throw new Error(createError?.message ?? "Contrato financeiro não criado.");
  }

  const typedCreatedContract =
    createdContract as unknown as GuardianFinancialContract;

  console.info("[GUARDIAN CONTRACT] contractFound", false);
  console.info("[GUARDIAN CONTRACT] contractCreated", typedCreatedContract.id);

  return typedCreatedContract;
}

export async function addEnrollmentToGuardianFinancialContract(
  enrollmentId: string,
): Promise<AddEnrollmentToGuardianContractResult> {
  console.log("[GUARDIAN CONTRACT START]", { enrollmentId });
  console.info("[GUARDIAN CONTRACT] addEnrollment start");
  console.info("[GUARDIAN CONTRACT] enrollmentId", enrollmentId);

  let guardianContractId: string | null = null;
  let supabase: ReturnType<typeof createAdminClient> | null = null;

  try {
    supabase = createAdminClient();
    const enrollment = await getEnrollmentSnapshot(supabase, enrollmentId);

    if (!enrollment) {
      throw new GuardianContractSyncError(
        "load_enrollment",
        "Matrícula não encontrada.",
      );
    }

    console.log("[GUARDIAN CONTRACT ENROLLMENT LOADED]", {
      enrollmentId: enrollment.id,
      status: enrollment.status,
      financialGuardianId: enrollment.financial_guardian_id,
      monthlyAmount: enrollment.monthly_amount,
      startDate: enrollment.start_date,
      endDate: enrollment.end_date,
      firstDueDate: enrollment.first_due_date,
    });

    if (!enrollment.financial_guardian_id) {
      throw new GuardianContractSyncError(
        "validate_enrollment",
        "Matrícula sem responsável financeiro.",
      );
    }

    if (enrollment.status !== "active") {
      throw new GuardianContractSyncError(
        "validate_enrollment",
        "Matrícula não ativa; contrato consolidado não atualizado.",
      );
    }

    console.info("[GUARDIAN CONTRACT] guardianId", enrollment.financial_guardian_id);

    const amount = normalizeAmount(enrollment.monthly_amount);

    if (!amount || amount <= 0) {
      throw new GuardianContractSyncError(
        "validate_enrollment",
        "Matrícula sem valor mensal válido.",
      );
    }

    if (!enrollment.start_date || !enrollment.end_date || !enrollment.first_due_date) {
      throw new GuardianContractSyncError(
        "validate_enrollment",
        "Matrícula sem datas financeiras obrigatórias.",
      );
    }

    const [student, danceClass, guardian] = await Promise.all([
      getStudent(supabase, enrollment.student_id),
      getClass(supabase, enrollment.class_id),
      getGuardian(supabase, enrollment.financial_guardian_id),
    ]);

    if (!guardian) {
      throw new GuardianContractSyncError(
        "validate_guardian",
        "Responsável financeiro não encontrado.",
      );
    }

    const year = Number(enrollment.start_date.slice(0, 4));

    if (!Number.isInteger(year)) {
      throw new GuardianContractSyncError(
        "validate_enrollment",
        "Ano da matrícula inválido.",
      );
    }

    console.info("[GUARDIAN CONTRACT] year", year);

    const guardianContract = await getOrCreateGuardianFinancialContractDraft({
      guardianId: enrollment.financial_guardian_id,
      provider: CONTA_AZUL_PROVIDER,
      providerCustomerId: guardian.conta_azul_person_id,
      year,
      startDate: enrollment.start_date,
      endDate: enrollment.end_date,
      firstDueDate: enrollment.first_due_date,
    });
    guardianContractId = guardianContract.id;
    console.log("[GUARDIAN CONTRACT FOUND OR CREATED]", {
      guardianContractId,
    });
    console.info("[GUARDIAN CONTRACT] contractId", guardianContract.id);
    const existingItem = await getExistingContractItem(supabase, enrollment.id);
    let itemId = existingItem?.id ? String(existingItem.id) : null;

    if (!existingItem) {
      const { data: createdItem, error: itemError } = await supabase
        .from("guardian_financial_contract_items")
        .insert({
          guardian_contract_id: guardianContract.id,
          enrollment_id: enrollment.id,
          student_id: enrollment.student_id,
          class_id: enrollment.class_id,
          description: buildDescription(student, danceClass),
          amount,
          status: "active",
          started_at: enrollment.start_date,
          ended_at: enrollment.end_date,
        })
        .select("id")
        .single();

      if (itemError) {
        if (itemError.code === "23505") {
          const duplicateItem = await getExistingContractItem(supabase, enrollment.id);
          itemId = duplicateItem?.id ? String(duplicateItem.id) : null;
          console.info("[GUARDIAN CONTRACT] itemCreated", false);
        } else {
          throw new GuardianContractSyncError(
            "insert_contract_item",
            itemError.message,
            itemError,
          );
        }
      } else {
        itemId = createdItem?.id ? String(createdItem.id) : null;
        console.log("[GUARDIAN CONTRACT ITEM INSERTED]", { itemId });
        console.info("[GUARDIAN CONTRACT] itemCreated", true);
      }
    } else {
      console.log("[GUARDIAN CONTRACT ITEM INSERTED]", { itemId });
      console.info("[GUARDIAN CONTRACT] itemCreated", false);
    }
    console.info("[GUARDIAN CONTRACT] itemId", itemId);

    const totalAmount = await recalculateContractTotal(supabase, guardianContract.id);
    const nextStatus = guardianContract.provider_contract_id
      ? "pending_replacement"
      : "draft";
    const { error: updateError } = await supabase
      .from("guardian_financial_contracts")
      .update({
        total_amount: totalAmount,
        status: nextStatus,
        error_message: null,
        last_sync_payload: null,
      })
      .eq("id", guardianContract.id);

    if (updateError) {
      throw new GuardianContractSyncError(
        "update_contract_total",
        updateError.message,
        updateError,
      );
    }

    console.info("[GUARDIAN CONTRACT] totalAmount", totalAmount);
    console.log("[GUARDIAN CONTRACT TOTAL UPDATED]", { totalAmount });

    return {
      status: "created",
      guardianContractId: guardianContract.id,
      totalAmount,
      itemId,
    };
  } catch (error) {
    const stage = getErrorStage(error);
    const message = getErrorMessage(error);
    const details = buildFailurePayload(error);

    console.error("[GUARDIAN CONTRACT] error", {
      enrollmentId,
      guardianContractId,
      stage,
      message,
      details,
    });
    console.error("[GUARDIAN CONTRACT ERROR]", {
      stage,
      enrollmentId,
      message,
      details: error,
    });

    if (supabase && guardianContractId) {
      await saveSyncFailure(supabase, guardianContractId, error);
    }

    return {
      status: "warning",
      enrollmentId,
      guardianContractId,
      stage,
      message,
      details,
    };
  }
}

export async function createContaAzulContractFromGuardianContract(
  guardianContractId: string,
) {
  return syncGuardianFinancialContractToContaAzul(guardianContractId);
}

export async function syncGuardianFinancialContractToContaAzul(
  guardianContractId: string,
) {
  const supabase = createAdminClient();
  let failurePersisted = false;
  console.info("[GUARDIAN CONTRACT SYNC] start");
  console.info("[GUARDIAN CONTRACT SYNC] guardianContractId", guardianContractId);

  try {
    const contract = await getGuardianContract(supabase, guardianContractId);

    if (!contract) {
      throw new GuardianContractSyncError(
        "load_contract",
        "Contrato financeiro consolidado não encontrado.",
      );
    }

    const syncData = await prepareContaAzulContractSync(supabase, contract);
    const hasProviderContract = Boolean(contract.provider_contract_id);

    console.info("[ENROLLMENT CONTRACT AUTO SYNC] stage", "load_active_items");
    console.info(
      "[ENROLLMENT CONTRACT AUTO SYNC] activeItemsCount",
      syncData.items.length,
    );
    console.info(
      "[ENROLLMENT CONTRACT AUTO SYNC] totalAmount",
      syncData.totalAmount,
    );
    console.info("[GUARDIAN CONTRACT SYNC] itemsCount", syncData.items.length);
    console.info("[GUARDIAN CONTRACT SYNC] totalAmount", syncData.totalAmount);
    console.info("[GUARDIAN CONTRACT SYNC] hasProviderContract", hasProviderContract);

    if (!hasProviderContract) {
      console.info("[GUARDIAN CONTRACT SYNC] creating Conta Azul contract");

      const created = await createContaAzulContractForSync(syncData);
      await updateGuardianContractAfterCreate(supabase, {
        guardianContractId,
        providerCustomerId: syncData.providerCustomerId,
        providerContractId: created.providerContractId,
        providerLegacyId: created.providerLegacyId,
        totalAmount: syncData.totalAmount,
        contractPayload: created.contractPayload,
        lastSyncPayload: {
          stage: "success",
          action: "created_on_enrollment",
          response: created.response,
          sanitized_payload: created.contractPayload.sanitized_payload,
        },
      });

      console.info("[GUARDIAN CONTRACT SYNC] success", {
        guardianContractId,
        providerContractId: created.providerContractId,
      });

      return {
        status: "active" as const,
        providerContractId: created.providerContractId,
        providerLegacyId: created.providerLegacyId,
        response: created.response,
      };
    }

    const oldProviderContractId = contract.provider_contract_id as string;
    await saveCurrentVersion(
      supabase,
      contract,
      "Substituição por nova sincronização consolidada",
      {
        status: "replaced",
        payload: contract.contract_payload ?? contract.last_sync_payload ?? null,
      },
    );

    console.info("[GUARDIAN CONTRACT SYNC] closing old contract");
    const closeResponse = await syncData.client.closeContaAzulContract(
      oldProviderContractId,
    );

    if (!closeResponse.ok) {
      const errorMessage = `Falha ao encerrar contrato antigo no Conta Azul: ${getRawResponseMessage(closeResponse.body)}`;
      const { error } = await supabase
        .from("guardian_financial_contracts")
        .update({
          status: "sync_failed",
          error_message: errorMessage,
          last_sync_payload: {
            action: "close_failed",
            old_provider_contract_id: oldProviderContractId,
            status: closeResponse.status,
            body: closeResponse.body,
          },
        })
        .eq("id", guardianContractId);

      if (error) {
        throw new GuardianContractSyncError(
          "save_close_failure",
          error.message,
          error,
        );
      }
      failurePersisted = true;

      throw new GuardianContractSyncError(
        "close_old_contract",
        errorMessage,
        closeResponse,
      );
    }

    console.info("[GUARDIAN CONTRACT SYNC] creating replacement contract");

    try {
      const created = await createContaAzulContractForSync(syncData);
      const nextVersion = (contract.version ?? 1) + 1;
      await updateGuardianContractAfterReplacement(supabase, {
        guardianContractId,
        providerCustomerId: syncData.providerCustomerId,
        providerContractId: created.providerContractId,
        providerLegacyId: created.providerLegacyId,
        version: nextVersion,
        totalAmount: syncData.totalAmount,
        contractPayload: created.contractPayload,
        lastSyncPayload: {
          action: "replaced",
          old_provider_contract_id: oldProviderContractId,
          close_response: closeResponse,
          new_response: created.response,
          sanitized_payload: created.contractPayload.sanitized_payload,
        },
      });

      console.info("[GUARDIAN CONTRACT SYNC] success", {
        guardianContractId,
        providerContractId: created.providerContractId,
      });

      return {
        status: "active" as const,
        providerContractId: created.providerContractId,
        providerLegacyId: created.providerLegacyId,
        response: created.response,
      };
    } catch (createError) {
      const { error } = await supabase
        .from("guardian_financial_contracts")
        .update({
          status: "sync_failed",
          error_message:
            "Contrato antigo encerrado, mas falhou ao criar novo contrato.",
          last_sync_payload: {
            action: "replacement_create_failed",
            old_provider_contract_id: oldProviderContractId,
            close_response: closeResponse,
            error: buildFailurePayload(createError),
          },
        })
        .eq("id", guardianContractId);

      if (error) {
        throw new GuardianContractSyncError(
          "save_replacement_create_failure",
          error.message,
          error,
        );
      }
      failurePersisted = true;

      throw createError;
    }
  } catch (error) {
    console.error("[GUARDIAN CONTRACT SYNC] failed", {
      guardianContractId,
      stage: getErrorStage(error),
      message: getErrorMessage(error),
      responseBody: getFailureResponseBody(error),
    });

    if (!failurePersisted) {
      await saveSyncFailure(supabase, guardianContractId, error);
    }

    return {
      status: "failed" as const,
      stage: getErrorStage(error),
      message: getErrorMessage(error),
    };
  }
}

export async function autoSyncGuardianFinancialContractAfterEnrollment(
  enrollmentId: string,
): Promise<AutoSyncGuardianContractResult> {
  const supabase = createAdminClient();
  console.info("[ENROLLMENT CONTRACT AUTO SYNC] start");
  console.info("[ENROLLMENT CONTRACT AUTO SYNC] enrollmentId", enrollmentId);

  try {
    const contract = await getGuardianContractByEnrollmentId(supabase, enrollmentId);

    if (!contract) {
      const message =
        "RPC executada, mas nenhum guardian_contract_id foi encontrado para a matrícula.";
      console.error("[ENROLLMENT CONTRACT AUTO SYNC] failed", {
        enrollmentId,
        stage: "load_guardian_contract",
        message,
      });

      return {
        status: "failed",
        guardianContractId: null,
        stage: "load_guardian_contract",
        message,
      };
    }

    const hasProviderContract = Boolean(contract.provider_contract_id);
    console.info(
      "[ENROLLMENT CONTRACT AUTO SYNC] guardianContractId",
      contract.id,
    );
    console.info("[ENROLLMENT CONTRACT AUTO SYNC] stage", "load_guardian_contract");
    console.info(
      "[ENROLLMENT CONTRACT AUTO SYNC] hasProviderContract",
      hasProviderContract,
    );

    if (hasProviderContract) {
      const reason =
        "Contrato já existe no Conta Azul. Nova matrícula adicionada internamente e pendente de sincronização.";
      const { error } = await supabase
        .from("guardian_financial_contracts")
        .update({
          status: "pending_replacement",
          error_message: null,
          last_sync_payload: {
            action: "pending_replacement",
            reason,
            enrollment_id: enrollmentId,
            provider_contract_id: contract.provider_contract_id,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", contract.id);

      if (error) {
        throw new GuardianContractSyncError(
          "mark_pending_replacement",
          error.message,
          error,
        );
      }

      console.info("[ENROLLMENT CONTRACT AUTO SYNC] markedPendingReplacement");
      console.info("[ENROLLMENT CONTRACT AUTO SYNC] success");

      return {
        status: "pending_replacement",
        guardianContractId: contract.id,
      };
    }

    console.info("[ENROLLMENT CONTRACT AUTO SYNC] stage", "create_conta_azul_contract");
    console.info("[ENROLLMENT CONTRACT AUTO SYNC] creatingContaAzulContract");
    const syncResult = await syncGuardianFinancialContractToContaAzul(contract.id);

    if (syncResult.status === "active") {
      console.info("[ENROLLMENT CONTRACT AUTO SYNC] success");

      return {
        status: "created",
        guardianContractId: contract.id,
        providerContractId: syncResult.providerContractId,
      };
    }

    console.error("[ENROLLMENT CONTRACT AUTO SYNC] failed", {
      guardianContractId: contract.id,
      stage: syncResult.stage,
      message: syncResult.message,
    });

    return {
      status: "failed",
      guardianContractId: contract.id,
      stage: syncResult.stage,
      message: syncResult.message,
    };
  } catch (error) {
    console.error("[ENROLLMENT CONTRACT AUTO SYNC] failed", {
      enrollmentId,
      stage: getErrorStage(error),
      message: getErrorMessage(error),
    });

    return {
      status: "failed",
      guardianContractId: null,
      stage: getErrorStage(error),
      message: getErrorMessage(error),
    };
  }
}

export async function backfillMissingGuardianContractItems() {
  const supabase = createAdminClient();
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select(
      "id, student_id, class_id, financial_guardian_id, monthly_amount, status, start_date, end_date, first_due_date",
    )
    .eq("status", "active")
    .not("financial_guardian_id", "is", null)
    .not("monthly_amount", "is", null)
    .not("start_date", "is", null)
    .not("end_date", "is", null)
    .not("first_due_date", "is", null);

  if (enrollmentsError) {
    throw new GuardianContractSyncError(
      "backfill_load_enrollments",
      enrollmentsError.message,
      enrollmentsError,
    );
  }

  const { data: existingItems, error: itemsError } = await supabase
    .from("guardian_financial_contract_items")
    .select("enrollment_id");

  if (itemsError) {
    throw new GuardianContractSyncError(
      "backfill_load_items",
      itemsError.message,
      itemsError,
    );
  }

  const enrollmentIdsWithItems = new Set(
    (existingItems ?? [])
      .map((item) => item.enrollment_id)
      .filter((id): id is string => typeof id === "string"),
  );
  const missingEnrollments = ((enrollments ?? []) as unknown as EnrollmentSnapshot[])
    .filter((enrollment) => !enrollmentIdsWithItems.has(enrollment.id))
    .filter((enrollment) => {
      const amount = normalizeAmount(enrollment.monthly_amount);

      return Boolean(amount && amount > 0);
    });
  const results: Array<{
    enrollmentId: string;
    status: "created" | "failed";
    guardianContractId?: string;
    itemId?: string | null;
    message?: string;
  }> = [];

  for (const enrollment of missingEnrollments) {
    const result = await addEnrollmentToGuardianFinancialContract(enrollment.id);

    if (result.status === "created") {
      results.push({
        enrollmentId: enrollment.id,
        status: "created",
        guardianContractId: result.guardianContractId,
        itemId: result.itemId,
      });
    } else {
      console.error("[GUARDIAN CONTRACT] backfill error", {
        enrollmentId: enrollment.id,
        stage: result.stage,
        message: result.message,
      });
      results.push({
        enrollmentId: enrollment.id,
        status: "failed",
        guardianContractId: result.guardianContractId ?? undefined,
        message: result.message,
      });
    }
  }

  return {
    scanned: enrollments?.length ?? 0,
    missing: missingEnrollments.length,
    created: results.filter((result) => result.status === "created").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  };
}

export async function cancelEnrollmentGuardianFinancialContractItem(input: {
  enrollmentId: string;
  cancelledAt: string;
}): Promise<CancelEnrollmentGuardianContractItemResult> {
  const supabase = createAdminClient();
  console.info("[GUARDIAN CONTRACT] enrollment cancelled", {
    enrollmentId: input.enrollmentId,
  });

  try {
    const { data: item, error: itemLoadError } = await supabase
      .from("guardian_financial_contract_items")
      .select("id, guardian_contract_id")
      .eq("enrollment_id", input.enrollmentId)
      .maybeSingle();

    if (itemLoadError) {
      throw new GuardianContractSyncError(
        "load_contract_item",
        itemLoadError.message,
        itemLoadError,
      );
    }

    if (!item?.guardian_contract_id || !item.id) {
      return {
        status: "skipped",
        enrollmentId: input.enrollmentId,
        reason: "Item do contrato consolidado não encontrado.",
      };
    }

    const endedAt = input.cancelledAt.slice(0, 10);
    const { error: itemUpdateError } = await supabase
      .from("guardian_financial_contract_items")
      .update({
        status: "cancelled",
        ended_at: endedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("enrollment_id", input.enrollmentId);

    if (itemUpdateError) {
      throw new GuardianContractSyncError(
        "cancel_contract_item",
        itemUpdateError.message,
        itemUpdateError,
      );
    }

    console.info("[GUARDIAN CONTRACT] item cancelled", {
      enrollmentId: input.enrollmentId,
      itemId: item.id,
      guardianContractId: item.guardian_contract_id,
    });

    const recalculated = await recalculateGuardianFinancialContractTotal(
      item.guardian_contract_id,
    );

    return {
      status: "updated",
      enrollmentId: input.enrollmentId,
      guardianContractId: item.guardian_contract_id,
      itemId: item.id,
      totalAmount: recalculated.totalAmount,
      contractStatus: recalculated.status,
    };
  } catch (error) {
    console.error("[GUARDIAN CONTRACT] cancellation error", {
      enrollmentId: input.enrollmentId,
      stage: getErrorStage(error),
      message: getErrorMessage(error),
      details: error,
    });

    return {
      status: "failed",
      enrollmentId: input.enrollmentId,
      stage: getErrorStage(error),
      message: getErrorMessage(error),
    };
  }
}

export async function recalculateGuardianFinancialContractTotal(
  guardianContractId: string,
) {
  const supabase = createAdminClient();
  const contract = await getGuardianContract(supabase, guardianContractId);

  if (!contract) {
    throw new GuardianContractSyncError(
      "load_contract",
      "Contrato financeiro consolidado não encontrado.",
    );
  }

  const totalAmount = await recalculateContractTotal(supabase, guardianContractId);
  const status: "draft" | "pending_replacement" = contract.provider_contract_id
    ? "pending_replacement"
    : "draft";
  const { error } = await supabase
    .from("guardian_financial_contracts")
    .update({
      total_amount: totalAmount,
      status,
      ...(status === "pending_replacement" ? {} : { error_message: null }),
    })
    .eq("id", guardianContractId);

  if (error) {
    throw new GuardianContractSyncError(
      "update_contract_total",
      error.message,
      error,
    );
  }

  console.info("[GUARDIAN CONTRACT] total recalculated", {
    guardianContractId,
    totalAmount,
  });

  if (status === "pending_replacement") {
    console.info("[GUARDIAN CONTRACT] marked pending_replacement", {
      guardianContractId,
    });
  }

  return {
    guardianContractId,
    totalAmount,
    status,
  };
}

export async function backfillCancelledGuardianContractItems() {
  const supabase = createAdminClient();
  const { data: items, error } = await supabase
    .from("guardian_financial_contract_items")
    .select(
      "id, enrollment_id, guardian_contract_id, enrollments!inner(status, cancelled_at)",
    )
    .eq("status", "active")
    .eq("enrollments.status", "cancelled");

  if (error) {
    throw new GuardianContractSyncError(
      "backfill_cancelled_items_load",
      error.message,
      error,
    );
  }

  const contractIds = new Set<string>();
  let updated = 0;

  for (const item of items ?? []) {
    const enrollment = item.enrollments as {
      status?: string | null;
      cancelled_at?: string | null;
    } | null;
    const cancelledAt = enrollment?.cancelled_at ?? new Date().toISOString();
    const { error: updateError } = await supabase
      .from("guardian_financial_contract_items")
      .update({
        status: "cancelled",
        ended_at: cancelledAt.slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (updateError) {
      throw new GuardianContractSyncError(
        "backfill_cancelled_item_update",
        updateError.message,
        updateError,
      );
    }

    updated += 1;

    if (typeof item.guardian_contract_id === "string") {
      contractIds.add(item.guardian_contract_id);
    }
  }

  for (const guardianContractId of contractIds) {
    await recalculateGuardianFinancialContractTotal(guardianContractId);
  }

  return {
    scanned: items?.length ?? 0,
    updated,
    recalculatedContracts: contractIds.size,
  };
}

export async function replaceGuardianContractOnContaAzul(
  guardianContractId: string,
  reason: string,
) {
  const supabase = createAdminClient();
  console.info("[GUARDIAN CONTRACT REPLACE] start");
  console.info("[GUARDIAN CONTRACT REPLACE] guardianContractId", guardianContractId);

  const contract = await getGuardianContract(supabase, guardianContractId);

  if (!contract) {
    throw new Error("Contrato financeiro consolidado não encontrado.");
  }

  if (!contract.provider_contract_id) {
    return createContaAzulContractFromGuardianContract(guardianContractId);
  }

  console.info(
    "[GUARDIAN CONTRACT REPLACE] oldProviderContractId",
    contract.provider_contract_id,
  );

  const activeItems = await getActiveContractItems(supabase, guardianContractId);

  try {
    await saveCurrentVersion(supabase, contract, reason);

    const closeResponse = await new ContaAzulClient().closeContract(
      contract.provider_contract_id,
    );
    console.info("[GUARDIAN CONTRACT REPLACE] closeStatus", closeResponse.status);

    if (activeItems.length === 0) {
      const closedAt = new Date().toISOString();
      const { error } = await supabase
        .from("guardian_financial_contracts")
        .update({
          status: "closed",
          provider_closed_at: closedAt,
          closed_reason: reason,
          last_sync_payload: {
            close: closeResponse,
          },
          error_message: null,
        })
        .eq("id", guardianContractId);

      if (error) {
        throw new Error(error.message);
      }

      return {
        status: "closed" as const,
        closeStatus: closeResponse.status,
      };
    }

    const replacedAt = new Date().toISOString();
    const { response, contractPayload, providerContractId, providerLegacyId } =
      await createProviderContractForCurrentItems(supabase, contract);
    const nextVersion = (contract.version ?? 1) + 1;
    const { error } = await supabase
      .from("guardian_financial_contracts")
      .update({
        provider_contract_id: providerContractId,
        provider_legacy_id: providerLegacyId,
        version: nextVersion,
        status: "active",
        provider_closed_at: replacedAt,
        closed_reason: reason,
        contract_payload: contractPayload,
        last_sync_payload: {
          close: closeResponse,
          create: contractPayload,
        },
        error_message: null,
      })
      .eq("id", guardianContractId);

    if (error) {
      throw new Error(error.message);
    }

    console.info("[GUARDIAN CONTRACT REPLACE] newProviderContractId", providerContractId);
    console.info("[GUARDIAN CONTRACT REPLACE] version", nextVersion);

    return {
      status: "active" as const,
      closeStatus: closeResponse.status,
      providerContractId,
      providerLegacyId,
      version: nextVersion,
      response,
    };
  } catch (error) {
    await saveSyncFailure(supabase, guardianContractId, error);
    throw error;
  }
}

async function createProviderContractForCurrentItems(
  supabase: ReturnType<typeof createAdminClient>,
  contract: GuardianFinancialContract,
) {
  const syncData = await prepareContaAzulContractSync(supabase, contract);
  const created = await createContaAzulContractForSync(syncData);

  await syncContractCustomerAndTotal(
    supabase,
    contract.id,
    syncData.providerCustomerId,
    syncData.totalAmount,
  );

  return {
    response: created.response,
    contractPayload: created.contractPayload,
    providerContractId: created.providerContractId,
    providerLegacyId: created.providerLegacyId,
  };
}

async function prepareContaAzulContractSync(
  supabase: ReturnType<typeof createAdminClient>,
  contract: GuardianFinancialContract,
) {
  console.info("[ENROLLMENT CONTRACT AUTO SYNC] stage", "load_finance_settings");
  const settings = await getContaAzulSettings(supabase);
  console.info("[GUARDIAN CONTRACT SYNC] settings loaded", {
    active: Boolean(settings?.active),
    hasServiceItemId: Boolean(settings?.conta_azul_service_item_id),
    hasRevenueCategoryId: Boolean(settings?.conta_azul_revenue_category_id),
    hasFinancialAccountId: Boolean(settings?.conta_azul_financial_account_id),
    hasDefaultDueDay: Boolean(settings?.default_due_day),
  });
  console.info("[ENROLLMENT CONTRACT AUTO SYNC] stage", "load_active_items");
  const [guardian, items] = await Promise.all([
    getGuardian(supabase, contract.guardian_id),
    getActiveContractItems(supabase, contract.id),
  ]);

  if (!guardian) {
    throw new GuardianContractSyncError(
      "load_guardian_contract",
      "Responsável financeiro não encontrado.",
    );
  }

  if (!settings?.active) {
    throw new GuardianContractSyncError(
      "load_finance_settings",
      "Configuração financeira Conta Azul inativa ou inexistente.",
    );
  }

  if (!settings.conta_azul_financial_account_id) {
    throw new GuardianContractSyncError(
      "load_finance_settings",
      "Conta financeira Conta Azul não configurada.",
    );
  }

  if (!settings.conta_azul_revenue_category_id) {
    throw new GuardianContractSyncError(
      "load_finance_settings",
      "Categoria Conta Azul não configurada.",
    );
  }

  if (!settings.conta_azul_service_item_id) {
    throw new GuardianContractSyncError(
      "load_finance_settings",
      "Serviço padrão Conta Azul não configurado.",
    );
  }

  if (!settings.default_due_day) {
    throw new GuardianContractSyncError(
      "load_finance_settings",
      "Dia padrão de vencimento não configurado.",
    );
  }

  const financialAccountId = settings.conta_azul_financial_account_id;
  const revenueCategoryId = settings.conta_azul_revenue_category_id;
  const serviceItemId = settings.conta_azul_service_item_id;
  const defaultDueDay = settings.default_due_day;

  if (items.length === 0) {
    throw new GuardianContractSyncError(
      "load_active_items",
      "Contrato consolidado sem itens ativos.",
    );
  }
  console.info("[GUARDIAN CONTRACT SYNC] items loaded", {
    guardianContractId: contract.id,
    activeItemsCount: items.length,
  });

  const totalAmount = await recalculateContractTotal(supabase, contract.id);

  if (totalAmount <= 0) {
    throw new GuardianContractSyncError(
      "load_active_items",
      "Contrato consolidado sem itens ativos.",
    );
  }

  if (!contract.start_date || !contract.end_date || !contract.first_due_date) {
    throw new GuardianContractSyncError(
      "build_contract_payload",
      "Contrato consolidado sem datas obrigatórias.",
    );
  }

  if (contract.end_date < contract.start_date) {
    throw new GuardianContractSyncError(
      "build_contract_payload",
      "Data final do contrato não pode ser anterior à data inicial.",
    );
  }

  console.info("[ENROLLMENT CONTRACT AUTO SYNC] stage", "ensure_conta_azul_customer");
  const providerCustomerId =
    guardian.conta_azul_person_id ?? (await ensureContaAzulCustomer(contract.guardian_id));
  console.info("[GUARDIAN CONTRACT SYNC] customer resolved", {
    guardianContractId: contract.id,
    providerCustomerId,
  });
  const todayString = toDateString(new Date());
  const firstDueDate = getValidFirstDueDate(
    contract.first_due_date,
    defaultDueDay,
    new Date(),
  );

  if (!providerCustomerId) {
    throw new GuardianContractSyncError(
      "ensure_conta_azul_customer",
      "Responsável financeiro sem cliente Conta Azul.",
    );
  }

  const { error: updateError } = await supabase
    .from("guardian_financial_contracts")
    .update({
      total_amount: totalAmount,
      provider_customer_id: providerCustomerId,
    })
    .eq("id", contract.id);

  if (updateError) {
    throw new GuardianContractSyncError(
      "update_contract_total",
      updateError.message,
      updateError,
    );
  }

  return {
    client: new ContaAzulClient(),
    contract,
    guardian,
    financialAccountId,
    revenueCategoryId,
    serviceItemId,
    defaultDueDay,
    items,
    totalAmount,
    providerCustomerId,
    todayString,
    firstDueDate,
  };
}

async function createContaAzulContractForSync(
  syncData: Awaited<ReturnType<typeof prepareContaAzulContractSync>>,
) {
  console.info("[ENROLLMENT CONTRACT AUTO SYNC] stage", "build_contract_payload");
  console.info("[GUARDIAN CONTRACT SYNC] payload built", {
    guardianContractId: syncData.contract.id,
    itemsCount: syncData.items.length,
    firstDueDate: syncData.firstDueDate,
  });
  console.info("[GUARDIAN CONTRACT SYNC] creating Conta Azul contract", {
    guardianContractId: syncData.contract.id,
  });
  const response = await syncData.client.createContract({
    customerId: syncData.providerCustomerId,
    contractNumber: buildUniqueContractNumber(),
    issueDate: syncData.todayString,
    startDate: syncData.contract.start_date,
    endDate: syncData.contract.end_date,
    firstDueDate: syncData.firstDueDate,
    dueDay: syncData.defaultDueDay,
    observations: buildContractObservation(syncData.guardian, syncData.contract),
    financialAccountId: syncData.financialAccountId,
    revenueCategoryId: syncData.revenueCategoryId,
    items: syncData.items.map((item) => ({
      itemId: syncData.serviceItemId,
      description: item.description,
      amount: normalizeAmount(item.amount) ?? 0,
    })),
  });
  const diagnostics = getContaAzulResponseDiagnostics(response);
  const contractPayload = buildContaAzulRequestPayload(diagnostics);
  const providerContractId = getContractId(response);
  const providerLegacyId = getLegacyId(response);

  if (!providerContractId) {
    throw new GuardianContractSyncError(
      "create_conta_azul_contract",
      "create_conta_azul_contract failed: resposta sem id do contrato.",
      {
        response_body: diagnostics?.body ?? response,
        sanitized_payload: diagnostics?.sanitizedPayload ?? null,
        status: diagnostics?.status ?? null,
      },
    );
  }

  return {
    response,
    contractPayload,
    providerContractId,
    providerLegacyId,
  };
}

async function updateGuardianContractAfterCreate(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    guardianContractId: string;
    providerCustomerId: string;
    providerContractId: string;
    providerLegacyId: string | null;
    totalAmount: number;
    contractPayload: unknown;
    lastSyncPayload: unknown;
  },
) {
  const { error } = await supabase
    .from("guardian_financial_contracts")
    .update({
      provider_contract_id: input.providerContractId,
      provider_legacy_id: input.providerLegacyId,
      provider_customer_id: input.providerCustomerId,
      status: "active",
      total_amount: input.totalAmount,
      contract_payload: input.contractPayload,
      last_sync_payload: input.lastSyncPayload,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.guardianContractId);

  if (error) {
    throw new GuardianContractSyncError(
      "save_provider_contract_id",
      error.message,
      error,
    );
  }
}

async function updateGuardianContractAfterReplacement(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    guardianContractId: string;
    providerCustomerId: string;
    providerContractId: string;
    providerLegacyId: string | null;
    version: number;
    totalAmount: number;
    contractPayload: unknown;
    lastSyncPayload: unknown;
  },
) {
  const { error } = await supabase
    .from("guardian_financial_contracts")
    .update({
      provider_contract_id: input.providerContractId,
      provider_legacy_id: input.providerLegacyId,
      provider_customer_id: input.providerCustomerId,
      version: input.version,
      status: "active",
      total_amount: input.totalAmount,
      provider_closed_at: null,
      closed_reason: null,
      contract_payload: input.contractPayload,
      last_sync_payload: input.lastSyncPayload,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.guardianContractId);

  if (error) {
    throw new GuardianContractSyncError(
      "update_replaced_contract",
      error.message,
      error,
    );
  }
}

async function getEnrollmentSnapshot(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
) {
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      "id, student_id, class_id, financial_guardian_id, monthly_amount, status, start_date, end_date, first_due_date",
    )
    .eq("id", enrollmentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as EnrollmentSnapshot | null) ?? null;
}

async function getGuardianContract(
  supabase: ReturnType<typeof createAdminClient>,
  guardianContractId: string,
) {
  const { data, error } = await supabase
    .from("guardian_financial_contracts")
    .select(buildGuardianContractSelect())
    .eq("id", guardianContractId)
    .maybeSingle();

  if (error) {
    throw new GuardianContractSyncError(
      "load_guardian_contract",
      error.message,
      error,
    );
  }

  return (data as unknown as GuardianFinancialContract | null) ?? null;
}

async function getGuardianContractByEnrollmentId(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
) {
  const { data: item, error } = await supabase
    .from("guardian_financial_contract_items")
    .select("guardian_contract_id")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  if (error) {
    throw new GuardianContractSyncError(
      "load_contract_item",
      error.message,
      error,
    );
  }

  const guardianContractId = item?.guardian_contract_id;

  if (typeof guardianContractId !== "string") {
    return null;
  }

  return getGuardianContract(supabase, guardianContractId);
}

async function getExistingContractItem(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
) {
  const { data, error } = await supabase
    .from("guardian_financial_contract_items")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getActiveContractItems(
  supabase: ReturnType<typeof createAdminClient>,
  guardianContractId: string,
) {
  const { data, error } = await supabase
    .from("guardian_financial_contract_items")
    .select(
      "id, enrollment_id, student_id, class_id, description, amount, status, started_at, ended_at, enrollments!inner(status)",
    )
    .eq("guardian_contract_id", guardianContractId)
    .eq("status", "active")
    .eq("enrollments.status", "active");

  if (error) {
    throw new GuardianContractSyncError(
      "load_active_items",
      error.message,
      error,
    );
  }

  return (data as unknown as GuardianContractItem[]) ?? [];
}

async function recalculateContractTotal(
  supabase: ReturnType<typeof createAdminClient>,
  guardianContractId: string,
) {
  return sumItemAmounts(await getActiveContractItems(supabase, guardianContractId));
}

async function getStudent(
  supabase: ReturnType<typeof createAdminClient>,
  studentId: string | null,
) {
  if (!studentId) {
    return null;
  }

  const { data, error } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("id", studentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as NamedRecord | null) ?? null;
}

async function getClass(
  supabase: ReturnType<typeof createAdminClient>,
  classId: string | null,
) {
  if (!classId) {
    return null;
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw new GuardianContractSyncError(
      "load_finance_settings",
      error.message,
      error,
    );
  }

  return (data as unknown as NamedRecord | null) ?? null;
}

async function getGuardian(
  supabase: ReturnType<typeof createAdminClient>,
  guardianId: string,
) {
  const { data, error } = await supabase
    .from("guardians")
    .select("id, full_name, conta_azul_person_id")
    .eq("id", guardianId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as GuardianRecord | null) ?? null;
}

async function getContaAzulSettings(
  supabase: ReturnType<typeof createAdminClient>,
) {
  const { data, error } = await supabase
    .from("finance_provider_settings")
    .select(
      "active, conta_azul_financial_account_id, conta_azul_revenue_category_id, conta_azul_service_item_id, default_due_day",
    )
    .eq("provider", CONTA_AZUL_PROVIDER)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as FinanceProviderSettings | null) ?? null;
}

async function saveCurrentVersion(
  supabase: ReturnType<typeof createAdminClient>,
  contract: GuardianFinancialContract,
  reason: string,
  options: {
    status?: string;
    payload?: unknown;
  } = {},
) {
  const { error } = await supabase
    .from("guardian_financial_contract_versions")
    .insert({
      guardian_contract_id: contract.id,
      provider: CONTA_AZUL_PROVIDER,
      provider_contract_id: contract.provider_contract_id,
      provider_legacy_id: contract.provider_legacy_id,
      version: contract.version ?? 1,
      status: options.status ?? contract.status,
      total_amount: normalizeAmount(contract.total_amount) ?? 0,
      started_at: contract.start_date,
      ended_at: contract.end_date,
      closed_at: new Date().toISOString(),
      close_reason: reason,
      payload: options.payload ?? contract.contract_payload ?? null,
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function saveSyncFailure(
  supabase: ReturnType<typeof createAdminClient>,
  guardianContractId: string,
  error: unknown,
) {
  const failurePayload = buildFailurePayload(error);
  const { error: updateError } = await supabase
    .from("guardian_financial_contracts")
    .update({
      status: "sync_failed",
      error_message: getErrorMessage(error),
      last_sync_payload: failurePayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", guardianContractId);

  if (updateError) {
    console.error("[GUARDIAN CONTRACT SYNC] failure persistence failed", {
      guardianContractId,
      message: updateError.message,
    });
  }
}

async function syncContractCustomerAndTotal(
  supabase: ReturnType<typeof createAdminClient>,
  guardianContractId: string,
  providerCustomerId: string,
  totalAmount: number,
) {
  const { error } = await supabase
    .from("guardian_financial_contracts")
    .update({
      provider_customer_id: providerCustomerId,
      total_amount: totalAmount,
    })
    .eq("id", guardianContractId);

  if (error) {
    throw new Error(error.message);
  }
}

function buildGuardianContractSelect() {
  return [
    "id",
    "guardian_id",
    "provider",
    "provider_customer_id",
    "provider_contract_id",
    "provider_legacy_id",
    "year",
    "version",
    "status",
    "total_amount",
    "start_date",
    "end_date",
    "first_due_date",
    "contract_payload",
    "last_sync_payload",
  ].join(", ");
}

function normalizeAmount(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }

  return null;
}

function sumItemAmounts(items: Array<{ amount: number | string }>) {
  return items.reduce((total, item) => {
    const amount = normalizeAmount(item.amount);

    return total + (amount ?? 0);
  }, 0);
}

function buildDescription(
  student: NamedRecord | null,
  danceClass: NamedRecord | null,
) {
  return `Mensalidade DK Studio - ${student?.full_name ?? "Aluno"} - ${
    danceClass?.name ?? "Turma"
  }`;
}

function buildContractObservation(
  guardian: GuardianRecord,
  contract: GuardianFinancialContract,
) {
  return `Contrato DK Studio ${contract.year} - ${guardian.full_name ?? "Responsável"}`;
}

async function ensureContaAzulCustomer(guardianId: string) {
  try {
    return await ensureContaAzulCustomerForGuardian(guardianId);
  } catch (error) {
    throw new GuardianContractSyncError(
      "ensure_conta_azul_customer",
      "Responsável financeiro sem cliente Conta Azul.",
      buildFailurePayload(error),
    );
  }
}

function buildUniqueContractNumber() {
  return Date.now();
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getValidFirstDueDate(
  firstDueDate: string,
  defaultDueDay: number,
  baseDate: Date,
) {
  const todayString = toDateString(baseDate);

  if (firstDueDate >= todayString) {
    return firstDueDate;
  }

  const today = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
  );
  let dueDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    clampDay(baseDate.getFullYear(), baseDate.getMonth(), defaultDueDay),
  );

  if (dueDate < today) {
    const nextMonth = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + 1,
      1,
    );
    dueDate = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      clampDay(nextMonth.getFullYear(), nextMonth.getMonth(), defaultDueDay),
    );
  }

  return toDateString(dueDate);
}

function clampDay(year: number, month: number, day: number) {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

function getContractId(response: unknown) {
  if (!response || typeof response !== "object") {
    return null;
  }

  const body = response as {
    id?: unknown;
    contractId?: unknown;
    contract_id?: unknown;
    data?: {
      id?: unknown;
      contractId?: unknown;
      contract_id?: unknown;
    };
    result?: {
      id?: unknown;
      contractId?: unknown;
      contract_id?: unknown;
    };
  };

  return firstStringValue([
    body.id,
    body.contractId,
    body.contract_id,
    body.data?.id,
    body.data?.contractId,
    body.data?.contract_id,
    body.result?.id,
    body.result?.contractId,
    body.result?.contract_id,
  ]);
}

function getLegacyId(response: unknown) {
  if (!response || typeof response !== "object") {
    return null;
  }

  const body = response as {
    id_legado?: unknown;
    data?: {
      id_legado?: unknown;
    };
    result?: {
      id_legado?: unknown;
    };
  };

  return firstStringValue([body.id_legado, body.data?.id_legado, body.result?.id_legado]);
}

function getRawResponseMessage(body: unknown) {
  if (!body) {
    return "Resposta vazia.";
  }

  if (typeof body === "string") {
    return body;
  }

  if (isRecord(body)) {
    const message =
      body.message ??
      body.mensagem ??
      body.error ??
      body.erro ??
      body.detail ??
      body.detalhe;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return "Erro retornado pelo Conta Azul.";
}

function firstStringValue(values: unknown[]) {
  for (const value of values) {
    if (
      (typeof value === "string" || typeof value === "number") &&
      String(value).trim().length > 0
    ) {
      return String(value);
    }
  }

  return null;
}

function buildContaAzulRequestPayload(
  diagnostics: ReturnType<typeof getContaAzulResponseDiagnostics>,
) {
  if (!diagnostics) {
    return {
      response: null,
      sanitized_payload: null,
    };
  }

  return {
    response: diagnostics.body,
    sanitized_payload: diagnostics.sanitizedPayload,
  };
}

function buildFailurePayload(error: unknown) {
  if (error instanceof GuardianContractSyncError) {
    return {
      stage: error.stage,
      error: error.message,
      message: error.message,
      details: sanitizeSyncPayload(error.details),
      sanitized_payload: getFailureSanitizedPayload(error.details),
      response_body: sanitizeSyncPayload(getFailureResponseBody(error.details)),
      status: getFailureStatus(error.details),
      timestamp: new Date().toISOString(),
    };
  }

  if (error instanceof ContaAzulApiError && error.details) {
    return {
      stage: error.details.stage ?? "conta_azul_request",
      error: error.message,
      message: error.message,
      details: {
        endpoint: error.details.endpoint ?? null,
        method: error.details.method ?? null,
      },
      status: error.details.status ?? error.status ?? null,
      response_body: sanitizeSyncPayload(error.details.body ?? null),
      sanitized_payload: sanitizeSyncPayload(error.details.payload ?? null),
      timestamp: new Date().toISOString(),
    };
  }

  return {
    stage: "pre_validation",
    error: getErrorMessage(error),
    message: getErrorMessage(error),
    details: null,
    sanitized_payload: null,
    response_body: null,
    status: null,
    timestamp: new Date().toISOString(),
  };
}

function getErrorStage(error: unknown) {
  if (error instanceof GuardianContractSyncError) {
    return error.stage;
  }

  if (error instanceof ContaAzulApiError) {
    return error.details?.stage ?? "conta_azul_request";
  }

  return "unknown";
}

function getFailureResponseBody(error: unknown) {
  if (error instanceof GuardianContractSyncError) {
    return getFailureResponseBody(error.details);
  }

  if (error instanceof ContaAzulApiError) {
    return error.details?.body ?? null;
  }

  if (isRecord(error) && "response_body" in error) {
    return error.response_body;
  }

  if (isRecord(error) && "body" in error) {
    return error.body;
  }

  return null;
}

function getFailureSanitizedPayload(error: unknown) {
  if (error instanceof GuardianContractSyncError) {
    return getFailureSanitizedPayload(error.details);
  }

  if (error instanceof ContaAzulApiError) {
    return sanitizeSyncPayload(error.details?.payload ?? null);
  }

  if (isRecord(error) && "sanitized_payload" in error) {
    return sanitizeSyncPayload(error.sanitized_payload);
  }

  if (isRecord(error) && "payload" in error) {
    return sanitizeSyncPayload(error.payload);
  }

  return null;
}

function getFailureStatus(error: unknown) {
  if (error instanceof GuardianContractSyncError) {
    return getFailureStatus(error.details);
  }

  if (error instanceof ContaAzulApiError) {
    return error.details?.status ?? error.status ?? null;
  }

  if (isRecord(error) && "status" in error) {
    return error.status;
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível sincronizar o contrato consolidado no Conta Azul.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeSyncPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSyncPayload(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      const normalizedKey = key.toLowerCase();
      const shouldMask =
        normalizedKey.includes("token") ||
        normalizedKey.includes("authorization") ||
        normalizedKey.includes("client_secret") ||
        normalizedKey.includes("secret") ||
        normalizedKey.includes("cpf") ||
        normalizedKey.includes("documento") ||
        normalizedKey.includes("document");

      return [key, shouldMask ? "[REDACTED]" : sanitizeSyncPayload(entryValue)];
    }),
  );
}
