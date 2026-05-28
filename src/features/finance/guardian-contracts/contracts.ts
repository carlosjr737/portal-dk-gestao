import "server-only";

import {
  ContaAzulApiError,
  ContaAzulClient,
  getContaAzulResponseDiagnostics,
} from "@/features/finance/conta-azul/client";
import { ensureContaAzulCustomerForGuardian } from "@/features/finance/conta-azul/guardian-links";
import { ensureContaAzulServiceItem } from "@/features/finance/conta-azul/enrollment-receivables";
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
  console.info("[GUARDIAN CONTRACT] start");
  console.info("[GUARDIAN CONTRACT] enrollmentId", enrollmentId);

  const enrollment = await getEnrollmentSnapshot(supabase, enrollmentId);

  if (!enrollment) {
    throw new Error("Matrícula não encontrada.");
  }

  if (!enrollment.financial_guardian_id) {
    throw new Error("Matrícula sem responsável financeiro.");
  }

  console.info("[GUARDIAN CONTRACT] guardianId", enrollment.financial_guardian_id);

  const amount = normalizeAmount(enrollment.monthly_amount);

  if (!amount || amount <= 0) {
    throw new Error("Matrícula sem valor mensal válido.");
  }

  if (!enrollment.start_date || !enrollment.end_date || !enrollment.first_due_date) {
    throw new Error("Matrícula sem datas financeiras obrigatórias.");
  }

  const [student, danceClass, guardian] = await Promise.all([
    getStudent(supabase, enrollment.student_id),
    getClass(supabase, enrollment.class_id),
    getGuardian(supabase, enrollment.financial_guardian_id),
  ]);

  if (!guardian) {
    throw new Error("Responsável financeiro não encontrado.");
  }

  const year = Number(enrollment.start_date.slice(0, 4));

  if (!Number.isInteger(year)) {
    throw new Error("Ano da matrícula inválido.");
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
  const existingItem = await getExistingContractItem(supabase, enrollment.id);

  if (!existingItem) {
    const { error: itemError } = await supabase
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
      });

    if (itemError) {
      if (itemError.code === "23505") {
        console.info("[GUARDIAN CONTRACT] itemCreated", false);
      } else {
        throw new Error(itemError.message);
      }
    } else {
      console.info("[GUARDIAN CONTRACT] itemCreated", true);
    }
  } else {
    console.info("[GUARDIAN CONTRACT] itemCreated", false);
  }

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
    })
    .eq("id", guardianContract.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  console.info("[GUARDIAN CONTRACT] totalAmount", totalAmount);

  return {
    guardianContractId: guardianContract.id,
    status: nextStatus,
    totalAmount,
  };
}

export async function createContaAzulContractFromGuardianContract(
  guardianContractId: string,
) {
  const supabase = createAdminClient();
  const contract = await getGuardianContract(supabase, guardianContractId);

  if (!contract) {
    throw new Error("Contrato financeiro consolidado não encontrado.");
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
    })
    .eq("id", guardianContractId);

  if (error) {
    throw new Error(error.message);
  }

  return {
    status: "active" as const,
    providerContractId,
    providerLegacyId,
    response,
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
    throw new Error("Responsável financeiro não encontrado.");
  }

  if (!settings?.active) {
    throw new Error("Configuração financeira Conta Azul inativa ou inexistente.");
  }

  if (!settings.conta_azul_financial_account_id) {
    throw new Error("Conta financeira Conta Azul não configurada.");
  }

  if (!settings.conta_azul_revenue_category_id) {
    throw new Error("Categoria de receita Conta Azul não configurada.");
  }

  if (!settings.default_due_day) {
    throw new Error("Dia padrão de vencimento não configurado.");
  }

  const totalAmount = sumItemAmounts(items);

  if (totalAmount <= 0) {
    throw new Error("Contrato consolidado sem itens ativos com valor.");
  }

  const customerId = await ensureContaAzulCustomerForGuardian(contract.guardian_id);
  const serviceItemId =
    settings.conta_azul_service_item_id ?? (await ensureContaAzulServiceItem());
  const client = new ContaAzulClient();
  const todayString = toDateString(new Date());
  const firstDueDate = getNextFutureDueDate(
    settings.default_due_day,
    contract.first_due_date,
  );
  const response = await client.createContract({
    customerId,
    contractNumber: await client.getNextContractNumber(),
    issueDate: todayString,
    startDate: todayString,
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
      "id, student_id, class_id, financial_guardian_id, monthly_amount, start_date, end_date, first_due_date",
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
  await supabase
    .from("guardian_financial_contracts")
    .update({
      status: "sync_failed",
      error_message: getErrorMessage(error),
      last_sync_payload: buildFailurePayload(error),
    })
    .eq("id", guardianContractId);
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

function getNextFutureDueDate(defaultDueDay: number, fallbackDueDate: string) {
  const today = new Date();
  const dueDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    clampDay(today.getFullYear(), today.getMonth(), defaultDueDay),
  );

  if (dueDate >= startOfToday(today)) {
    return toDateString(dueDate);
  }

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextDueDate = new Date(
    nextMonth.getFullYear(),
    nextMonth.getMonth(),
    clampDay(nextMonth.getFullYear(), nextMonth.getMonth(), defaultDueDay),
  );
  const nextDueDateString = toDateString(nextDueDate);

  return nextDueDateString > fallbackDueDate ? nextDueDateString : fallbackDueDate;
}

function clampDay(year: number, month: number, day: number) {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

function startOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
  if (error instanceof ContaAzulApiError && error.details) {
    return {
      stage: error.details.stage ?? "conta_azul_request",
      endpoint: error.details.endpoint ?? null,
      method: error.details.method ?? null,
      status: error.details.status ?? error.status ?? null,
      body: error.details.body ?? null,
      sanitized_payload: error.details.payload ?? null,
    };
  }

  return {
    stage: "pre_validation",
    reason: getErrorMessage(error),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível sincronizar o contrato consolidado no Conta Azul.";
}
