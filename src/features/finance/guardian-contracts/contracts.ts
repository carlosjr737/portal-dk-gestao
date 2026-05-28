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
  provider_sale_id: string | null;
  year: number;
  version: number | null;
  status: string;
  total_amount: number | string;
  start_date: string;
  end_date: string;
  first_due_date: string;
  contract_payload?: unknown;
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
) {
  const supabase = createAdminClient();
  console.info("[GUARDIAN CONTRACT] addEnrollment start");
  console.info("[GUARDIAN CONTRACT] enrollmentId", enrollmentId);

  let guardianContractId: string | null = null;

  try {
    const enrollment = await getEnrollmentSnapshot(supabase, enrollmentId);

    if (!enrollment) {
      throw new GuardianContractSyncError(
        "load_enrollment",
        "Matrícula não encontrada.",
      );
    }

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
        console.info("[GUARDIAN CONTRACT] itemCreated", true);
      }
    } else {
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

    return {
      guardianContractId: guardianContract.id,
      status: nextStatus,
      totalAmount,
      itemId,
    };
  } catch (error) {
    console.error("[GUARDIAN CONTRACT] failed stage", getErrorStage(error));
    console.error("[GUARDIAN CONTRACT] error message", getErrorMessage(error));
    console.error("[GUARDIAN CONTRACT] error", {
      stage: getErrorStage(error),
      message: getErrorMessage(error),
    });

    if (guardianContractId) {
      await saveSyncFailure(supabase, guardianContractId, error);
    }

    throw error;
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

  try {
    const contract = await getGuardianContract(supabase, guardianContractId);

    if (!contract) {
      throw new GuardianContractSyncError(
        "load_contract",
        "Contrato financeiro consolidado não encontrado.",
      );
    }

    if (contract.provider_contract_id) {
      return {
        status: "active" as const,
        providerContractId: contract.provider_contract_id,
        providerLegacyId: contract.provider_legacy_id,
        response: null,
      };
    }

    const { response, contractPayload, providerContractId, providerLegacyId } =
      await createProviderContractForCurrentItems(supabase, contract);
    const { error } = await supabase
      .from("guardian_financial_contracts")
      .update({
        provider_contract_id: providerContractId,
        provider_legacy_id: providerLegacyId,
        status: "active",
        contract_payload: contractPayload,
        error_message: null,
        last_sync_payload: null,
      })
      .eq("id", guardianContractId);

    if (error) {
      throw new GuardianContractSyncError(
        "update_synced_contract",
        error.message,
        error,
      );
    }

    return {
      status: "active" as const,
      providerContractId,
      providerLegacyId,
      response,
    };
  } catch (error) {
    console.error("[GUARDIAN CONTRACT SYNC] failed stage", getErrorStage(error));
    console.error("[GUARDIAN CONTRACT SYNC] error message", getErrorMessage(error));
    console.error(
      "[GUARDIAN CONTRACT SYNC] response body",
      getFailureResponseBody(error),
    );

    await saveSyncFailure(supabase, guardianContractId, error);
    throw error;
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
    try {
      const result = await addEnrollmentToGuardianFinancialContract(enrollment.id);
      results.push({
        enrollmentId: enrollment.id,
        status: "created",
        guardianContractId: result.guardianContractId,
        itemId: result.itemId,
      });
    } catch (error) {
      console.error("[GUARDIAN CONTRACT] backfill error", {
        enrollmentId: enrollment.id,
        stage: getErrorStage(error),
        message: getErrorMessage(error),
      });
      results.push({
        enrollmentId: enrollment.id,
        status: "failed",
        message: getErrorMessage(error),
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
  const [guardian, settings, items] = await Promise.all([
    getGuardian(supabase, contract.guardian_id),
    getContaAzulSettings(supabase),
    getActiveContractItems(supabase, contract.id),
  ]);

  if (!guardian) {
    throw new GuardianContractSyncError(
      "validate_guardian",
      "Responsável financeiro não encontrado.",
    );
  }

  if (!settings?.active) {
    throw new GuardianContractSyncError(
      "validate_finance_settings",
      "Configuração financeira Conta Azul inativa ou inexistente.",
    );
  }

  if (!settings.conta_azul_financial_account_id) {
    throw new GuardianContractSyncError(
      "validate_finance_settings",
      "Conta financeira Conta Azul não configurada.",
    );
  }

  if (!settings.conta_azul_revenue_category_id) {
    throw new GuardianContractSyncError(
      "validate_finance_settings",
      "Categoria Conta Azul não configurada.",
    );
  }

  if (!settings.conta_azul_service_item_id) {
    throw new GuardianContractSyncError(
      "validate_finance_settings",
      "Serviço padrão Conta Azul não configurado.",
    );
  }

  if (!settings.default_due_day) {
    throw new GuardianContractSyncError(
      "validate_finance_settings",
      "Dia padrão de vencimento não configurado.",
    );
  }

  if (items.length === 0) {
    throw new GuardianContractSyncError(
      "validate_contract_items",
      "Contrato consolidado sem itens ativos.",
    );
  }

  const totalAmount = sumItemAmounts(items);

  if (totalAmount <= 0) {
    throw new GuardianContractSyncError(
      "validate_contract_items",
      "Contrato consolidado sem itens ativos.",
    );
  }

  if (contract.end_date < contract.start_date) {
    throw new GuardianContractSyncError(
      "validate_contract_dates",
      "Data final do contrato não pode ser anterior à data inicial.",
    );
  }

  const customerId = await ensureContaAzulCustomer(contract.guardian_id);
  const serviceItemId = settings.conta_azul_service_item_id;
  const client = new ContaAzulClient();
  const todayString = toDateString(new Date());
  const firstDueDate = contract.first_due_date;

  if (firstDueDate < todayString) {
    throw new GuardianContractSyncError(
      "validate_contract_dates",
      "Primeiro vencimento não pode ser anterior à data atual.",
      {
        firstDueDate,
        today: todayString,
      },
    );
  }

  const response = await client.createContract({
    customerId,
    contractNumber: buildUniqueContractNumber(),
    issueDate: todayString,
    startDate: contract.start_date,
    endDate: contract.end_date,
    firstDueDate,
    dueDay: settings.default_due_day,
    observations: buildContractObservation(guardian, contract),
    financialAccountId: settings.conta_azul_financial_account_id,
    revenueCategoryId: settings.conta_azul_revenue_category_id,
    items: items.map((item) => ({
      itemId: serviceItemId,
      description: item.description,
      amount: normalizeAmount(item.amount) ?? 0,
    })),
  });
  const diagnostics = getContaAzulResponseDiagnostics(response);
  const contractPayload = buildContaAzulRequestPayload(diagnostics);
  const providerContractId = getContractId(response);
  const providerLegacyId = getLegacyId(response);

  if (!providerContractId) {
    throw new Error("create_contract failed: resposta sem id do contrato.");
  }

  await syncContractCustomerAndTotal(supabase, contract.id, customerId, totalAmount);

  return {
    response,
    contractPayload,
    providerContractId,
    providerLegacyId,
  };
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
    throw new Error(error.message);
  }

  return (data as unknown as GuardianFinancialContract | null) ?? null;
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
      "id, enrollment_id, student_id, class_id, description, amount, status, started_at, ended_at",
    )
    .eq("guardian_contract_id", guardianContractId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
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
    throw new Error(error.message);
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
) {
  const { error } = await supabase
    .from("guardian_financial_contract_versions")
    .insert({
      guardian_contract_id: contract.id,
      provider_contract_id: contract.provider_contract_id,
      provider_legacy_id: contract.provider_legacy_id,
      version: contract.version ?? 1,
      status: contract.status,
      total_amount: normalizeAmount(contract.total_amount) ?? 0,
      started_at: contract.start_date,
      ended_at: contract.end_date,
      closed_at: new Date().toISOString(),
      close_reason: reason,
      payload: contract.contract_payload ?? null,
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
  const { error: updateError } = await supabase
    .from("guardian_financial_contracts")
    .update({
      status: "sync_failed",
      error_message: getErrorMessage(error),
      last_sync_payload: buildFailurePayload(error),
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
    "provider_sale_id",
    "year",
    "version",
    "status",
    "total_amount",
    "start_date",
    "end_date",
    "first_due_date",
    "contract_payload",
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
  return `Contrato consolidado DK Studio - ${guardian.full_name ?? "Responsável"} - ${
    contract.year
  }`;
}

async function ensureContaAzulCustomer(guardianId: string) {
  try {
    return await ensureContaAzulCustomerForGuardian(guardianId);
  } catch (error) {
    throw new GuardianContractSyncError(
      "ensure_customer",
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
      stage: "create_contract",
      reason: "Resposta Conta Azul sem diagnóstico de requisição.",
    };
  }

  return {
    stage: diagnostics.stage ?? "create_contract",
    endpoint: diagnostics.endpoint,
    method: diagnostics.method,
    status: diagnostics.status,
    response: diagnostics.body,
    sanitized_payload: diagnostics.sanitizedPayload,
  };
}

function buildFailurePayload(error: unknown) {
  if (error instanceof GuardianContractSyncError) {
    return {
      stage: error.stage,
      error: error.message,
      details: error.details,
      sanitized_payload: null,
      response_body: getFailureResponseBody(error.details),
      status: getFailureStatus(error.details),
    };
  }

  if (error instanceof ContaAzulApiError && error.details) {
    return {
      stage: error.details.stage ?? "conta_azul_request",
      error: error.message,
      details: {
        endpoint: error.details.endpoint ?? null,
        method: error.details.method ?? null,
      },
      status: error.details.status ?? error.status ?? null,
      response_body: error.details.body ?? null,
      sanitized_payload: error.details.payload ?? null,
    };
  }

  return {
    stage: "pre_validation",
    error: getErrorMessage(error),
    details: null,
    sanitized_payload: null,
    response_body: null,
    status: null,
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
