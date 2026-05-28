import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ContaAzulApiError,
  ContaAzulClient,
  getContaAzulResponseDiagnostics,
} from "@/features/finance/conta-azul/client";
import { ensureContaAzulCustomerForGuardian } from "@/features/finance/conta-azul/guardian-links";

const CONTA_AZUL_PROVIDER = "conta_azul";
const DEFAULT_CONTA_AZUL_SERVICE_NAME = "Mensalidade DK Studio";

type EnrollmentReceivableResult = {
  status:
    | "skipped"
    | "processing"
    | "receivable_created"
    | "contract_created"
    | "failed"
    | "already_created";
  message?: string;
  providerReceivableId?: string;
  providerProtocolId?: string;
  providerContractId?: string;
};

type CreateContaAzulReceivableOptions = {
  mode?: "automatic" | "manual" | "contract";
};

type FinanceProviderSettings = {
  active: boolean | null;
  auto_create_receivable_on_enrollment: boolean | null;
  conta_azul_financial_account_id: string | null;
  conta_azul_financial_account_name?: string | null;
  conta_azul_revenue_category_id: string | null;
  conta_azul_revenue_category_name?: string | null;
  conta_azul_service_item_id?: string | null;
  conta_azul_service_item_name?: string | null;
  default_due_day: number | null;
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
  created_at: string | null;
};

type NamedRecord = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  teacher_name?: string | null;
};

type GuardianDebugRecord = {
  id: string;
  document: string | null;
  conta_azul_person_id: string | null;
};

type RecordPayload = {
  enrollment_id: string;
  student_id: string | null;
  guardian_id: string | null;
  provider: typeof CONTA_AZUL_PROVIDER;
  provider_customer_id?: string | null;
  provider_protocol_id?: string | null;
  provider_receivable_id?: string | null;
  provider_contract_id?: string | null;
  provider_sale_id?: string | null;
  external_reference?: string | null;
  provider_payload?: unknown;
  contract_payload?: unknown;
  amount?: number | null;
  due_date?: string | null;
  contract_started_at?: string | null;
  contract_ends_at?: string | null;
  status:
    | "skipped"
    | "processing"
    | "receivable_created"
    | "contract_created"
    | "failed";
  error_message?: string | null;
};

export async function createContaAzulContractForEnrollment(
  enrollmentId: string,
): Promise<EnrollmentReceivableResult> {
  let supabase: ReturnType<typeof createAdminClient>;
  let failureStudentId: string | null = null;
  let failureGuardianId: string | null = null;
  let failureCustomerId: string | null = null;
  let failureAmount: number | null = null;
  let failureDueDate: string | null = null;
  let failureContractPayload: unknown = null;

  try {
    supabase = createAdminClient();
  } catch (error) {
    return {
      status: "failed",
      message: getErrorMessage(error),
    };
  }

  try {
    const existingContract = await getExistingContract(supabase, enrollmentId);
    console.info("[CA CONTRACT] enrollmentId", enrollmentId);

    if (existingContract) {
      return {
        status: "already_created",
        message: "Esta matrícula já possui contrato no Conta Azul.",
        providerContractId:
          (existingContract.provider_contract_id as string | null) ?? undefined,
      };
    }

    const enrollment = await getEnrollmentSnapshot(supabase, enrollmentId);

    if (!enrollment) {
      return {
        status: "failed",
        message: "Matrícula não encontrada.",
      };
    }

    failureStudentId = enrollment.student_id;
    failureGuardianId = enrollment.financial_guardian_id;

    const settings = await getContaAzulSettings(supabase);
    const skippedMessage = getSkippedSettingsMessage(settings, "contract");

    if (skippedMessage) {
      await saveFinancialRecord(supabase, {
        enrollment_id: enrollment.id,
        student_id: enrollment.student_id,
        guardian_id: enrollment.financial_guardian_id,
        provider: CONTA_AZUL_PROVIDER,
        contract_payload: buildPreValidationPayload(skippedMessage),
        status: "skipped",
        error_message: skippedMessage,
      });

      return {
        status: "skipped",
        message: skippedMessage,
      };
    }

    if (!settings) {
      return {
        status: "skipped",
        message: "Configuração financeira Conta Azul não encontrada.",
      };
    }

    if (!settings.conta_azul_financial_account_id) {
      return await saveContractFailure(
        supabase,
        enrollment,
        "Conta financeira Conta Azul não configurada.",
      );
    }

    if (!settings.conta_azul_revenue_category_id) {
      return await saveContractFailure(
        supabase,
        enrollment,
        "Categoria de receita Conta Azul não configurada.",
      );
    }

    if (!settings.default_due_day) {
      return await saveContractFailure(
        supabase,
        enrollment,
        "Dia padrão de vencimento não configurado.",
      );
    }

    if (enrollment.status !== "active") {
      return await saveContractFailure(
        supabase,
        enrollment,
        "Matrícula não ativa; contrato Conta Azul não gerado.",
      );
    }

    if (!enrollment.financial_guardian_id) {
      return await saveContractFailure(
        supabase,
        enrollment,
        "Matrícula sem responsável financeiro.",
      );
    }

    const guardianDebug = await getGuardianDebug(
      supabase,
      enrollment.financial_guardian_id,
    );

    if (!guardianDebug?.document) {
      return await saveContractFailure(
        supabase,
        enrollment,
        "Responsável financeiro sem CPF.",
      );
    }

    const amount = normalizeAmount(enrollment.monthly_amount);

    if (!amount || amount <= 0) {
      return await saveContractFailure(
        supabase,
        enrollment,
        "Valor mensal ausente ou inválido para criar contrato.",
        amount,
      );
    }

    const [student, danceClass] = await Promise.all([
      getStudent(supabase, enrollment.student_id),
      getClass(supabase, enrollment.class_id),
    ]);
    const contractItemId =
      settings.conta_azul_service_item_id ??
      (await ensureContaAzulServiceItem());
    const customerId = await ensureContaAzulCustomerForGuardian(
      enrollment.financial_guardian_id,
    );
    failureCustomerId = customerId;
    failureAmount = amount;

    const today = new Date();
    const todayString = toDateString(today);
    const startDate = enrollment.start_date ?? todayString;
    const firstDueDate =
      enrollment.first_due_date ??
      calculateFirstDueDate(settings.default_due_day, today);
    failureDueDate = firstDueDate;
    if (firstDueDate < todayString) {
      return await saveContractFailure(
        supabase,
        enrollment,
        "O primeiro vencimento não pode ser anterior à data de hoje para gerar contrato no Conta Azul.",
        amount,
        customerId,
        firstDueDate,
      );
    }
    console.log("[CA CONTRACT] enrollmentStartDate", startDate);
    console.log("[CA CONTRACT] today", todayString);
    console.log("[CA CONTRACT] defaultDueDay", settings.default_due_day);
    console.log("[CA CONTRACT] firstDueDate", firstDueDate);
    const client = new ContaAzulClient();
    const contractNumber = await client.getNextContractNumber();
    const description = buildMonthlyServiceDescription(student);
    const observations = buildContractObservation(student, danceClass);
    const response = await client.createContract({
      customerId,
      contractNumber,
      issueDate: todayString,
      startDate,
      endDate: enrollment.end_date,
      firstDueDate,
      dueDay: settings.default_due_day,
      description,
      observations,
      amount,
      financialAccountId: settings.conta_azul_financial_account_id,
      revenueCategoryId: settings.conta_azul_revenue_category_id,
      itemId: contractItemId,
    });
    const responseDiagnostics = getContaAzulResponseDiagnostics(response);
    const contractPayload = buildContaAzulRequestPayload(responseDiagnostics);
    failureContractPayload = contractPayload;
    const contractId = getContractId(response);
    const saleId = getSaleId(response);

    if (!contractId) {
      return await saveContractFailure(
        supabase,
        enrollment,
        "create_contract failed: resposta sem id do contrato.",
        amount,
        customerId,
        firstDueDate,
        contractPayload,
      );
    }

    console.log("[CA CONTRACT] response status", responseDiagnostics?.status ?? null);
    console.log("[CA CONTRACT] detected contract", contractId);

    await saveFinancialRecord(supabase, {
      enrollment_id: enrollment.id,
      student_id: enrollment.student_id,
      guardian_id: enrollment.financial_guardian_id,
      provider: CONTA_AZUL_PROVIDER,
      provider_customer_id: customerId,
      provider_contract_id: contractId,
      provider_sale_id: saleId,
      contract_payload: contractPayload,
      amount,
      due_date: firstDueDate,
      contract_started_at: startDate,
      contract_ends_at: enrollment.end_date,
      status: "contract_created",
      error_message: null,
    });

    return {
      status: "contract_created",
      providerContractId: contractId,
    };
  } catch (error) {
    failureContractPayload = buildFailurePayload(error);
    console.error("Conta Azul enrollment contract failed:", {
      enrollmentId,
      status: "failed",
      message: getErrorMessage(error),
      payload: failureContractPayload,
    });

    try {
      return await saveFailure(
        supabase,
        enrollmentId,
        failureStudentId,
        failureGuardianId,
        getErrorMessage(error),
        failureAmount,
        failureCustomerId,
        failureDueDate,
        null,
        failureContractPayload,
      );
    } catch (recordError) {
      console.error("Conta Azul enrollment contract failure record failed:", {
        enrollmentId,
        message: getErrorMessage(recordError),
      });

      return {
        status: "failed",
        message: getErrorMessage(error),
      };
    }
  }
}

export async function ensureContaAzulServiceItem(price = 0) {
  const supabase = createAdminClient();
  const settings = await getContaAzulSettings(supabase);

  if (settings?.conta_azul_service_item_id) {
    return settings.conta_azul_service_item_id;
  }

  const client = new ContaAzulClient();
  const services = await client.listServices("Mensalidade");
  const existingService =
    services.find(
      (service) =>
        service.status === "ATIVO" &&
        normalizeText(service.descricao).includes(
          normalizeText(DEFAULT_CONTA_AZUL_SERVICE_NAME),
        ),
    ) ??
    services.find(
      (service) =>
        service.status === "ATIVO" &&
        normalizeText(service.descricao).includes("mensalidade"),
    ) ??
    null;

  if (existingService) {
    await saveContaAzulServiceItem(
      supabase,
      existingService.id,
      existingService.descricao,
    );

    return existingService.id;
  }

  const createdService = await client.createService({
    descricao: DEFAULT_CONTA_AZUL_SERVICE_NAME,
    preco: price,
  });
  const serviceId = getContractId(createdService);
  const serviceName =
    typeof createdService.descricao === "string"
      ? createdService.descricao
      : DEFAULT_CONTA_AZUL_SERVICE_NAME;

  if (!serviceId) {
    throw new Error("create_service failed: resposta sem id do serviço.");
  }

  await saveContaAzulServiceItem(supabase, serviceId, serviceName);

  return serviceId;
}

export async function createContaAzulReceivableForEnrollment(
  enrollmentId: string,
  options: CreateContaAzulReceivableOptions = {},
): Promise<EnrollmentReceivableResult> {
  const mode = options.mode ?? "automatic";
  let supabase: ReturnType<typeof createAdminClient>;
  let failureStudentId: string | null = null;
  let failureGuardianId: string | null = null;
  let failureCustomerId: string | null = null;
  let failureAmount: number | null = null;
  let failureDueDate: string | null = null;
  let failurePayload: unknown = null;

  try {
    supabase = createAdminClient();
  } catch (error) {
    return {
      status: "failed",
      message: getErrorMessage(error),
    };
  }

  try {
    const existingReceivable = await getExistingReceivableOrProcessing(
      supabase,
      enrollmentId,
    );
    console.info("[CA RECEIVABLE] enrollmentId", enrollmentId);

    if (existingReceivable) {
      return {
        status: "already_created",
        message:
          "Já existe uma cobrança em processamento ou criada para esta matrícula.",
        providerReceivableId:
          (existingReceivable.provider_receivable_id as string | null) ?? undefined,
        providerProtocolId:
          (existingReceivable.provider_protocol_id as string | null) ?? undefined,
      };
    }

    const enrollment = await getEnrollmentSnapshot(supabase, enrollmentId);

    if (!enrollment) {
      return {
        status: "failed",
        message: "Matrícula não encontrada.",
      };
    }

    failureStudentId = enrollment.student_id;
    failureGuardianId = enrollment.financial_guardian_id;
    console.info("[CA RECEIVABLE] guardianId", enrollment.financial_guardian_id);

    const settings = await getContaAzulSettings(supabase);
    console.info("[CA RECEIVABLE] financialAccountConfigured", {
      configured: Boolean(settings?.conta_azul_financial_account_id),
    });
    console.info("[CA RECEIVABLE] revenueCategoryConfigured", {
      configured: Boolean(settings?.conta_azul_revenue_category_id),
    });

    const skippedMessage = getSkippedSettingsMessage(settings, mode);

    if (skippedMessage) {
      await saveFinancialRecord(supabase, {
        enrollment_id: enrollment.id,
        student_id: enrollment.student_id,
        guardian_id: enrollment.financial_guardian_id,
        provider: CONTA_AZUL_PROVIDER,
        provider_payload: buildPreValidationPayload(skippedMessage),
        status: "skipped",
        error_message: skippedMessage,
      });

      return {
        status: "skipped",
        message: skippedMessage,
      };
    }

    if (!settings) {
      return {
        status: "skipped",
        message: "Configuração financeira Conta Azul não encontrada.",
      };
    }

    if (!settings?.conta_azul_financial_account_id) {
      return await saveFailure(
        supabase,
        enrollment.id,
        enrollment.student_id,
        enrollment.financial_guardian_id,
        "Conta financeira Conta Azul não configurada.",
        null,
        null,
        null,
        buildPreValidationPayload("Conta financeira Conta Azul não configurada."),
      );
    }

    if (!settings.conta_azul_revenue_category_id) {
      return await saveFailure(
        supabase,
        enrollment.id,
        enrollment.student_id,
        enrollment.financial_guardian_id,
        "Categoria de receita Conta Azul não configurada.",
        null,
        null,
        null,
        buildPreValidationPayload("Categoria de receita Conta Azul não configurada."),
      );
    }

    if (mode === "manual" && !settings.default_due_day) {
      return await saveFailure(
        supabase,
        enrollment.id,
        enrollment.student_id,
        enrollment.financial_guardian_id,
        "Dia padrão de vencimento não configurado.",
        null,
        null,
        null,
        buildPreValidationPayload("Dia padrão de vencimento não configurado."),
      );
    }

    if (enrollment.status !== "active") {
      const message =
        mode === "manual"
          ? "Matrícula não ativa; conta a receber não gerada."
          : "Matrícula não ativa; criação automática de conta a receber ignorada.";

      await saveFinancialRecord(supabase, {
        enrollment_id: enrollment.id,
        student_id: enrollment.student_id,
        guardian_id: enrollment.financial_guardian_id,
        provider: CONTA_AZUL_PROVIDER,
        provider_payload: buildPreValidationPayload(message),
        status: "skipped",
        error_message: message,
      });

      return {
        status: "skipped",
        message,
      };
    }

    if (!enrollment.financial_guardian_id) {
      const message = "Matrícula sem responsável financeiro.";

      await saveFinancialRecord(supabase, {
        enrollment_id: enrollment.id,
        student_id: enrollment.student_id,
        guardian_id: null,
        provider: CONTA_AZUL_PROVIDER,
        provider_payload: buildPreValidationPayload(message),
        status: "skipped",
        error_message: message,
      });

      return {
        status: "skipped",
        message,
      };
    }

    const guardianDebug = await getGuardianDebug(
      supabase,
      enrollment.financial_guardian_id,
    );
    console.info("[CA RECEIVABLE] hasGuardian", Boolean(guardianDebug));
    console.info("[CA RECEIVABLE] hasGuardianDocument", {
      hasDocument: Boolean(guardianDebug?.document),
    });
    console.info("[CA RECEIVABLE] contaAzulPersonIdBefore", {
      present: Boolean(guardianDebug?.conta_azul_person_id),
      value: guardianDebug?.conta_azul_person_id ?? null,
    });

    const amount = normalizeAmount(enrollment.monthly_amount);

    if (!amount || amount <= 0) {
      return await saveFailure(
        supabase,
        enrollment.id,
        enrollment.student_id,
        enrollment.financial_guardian_id,
        "Valor mensal ausente ou inválido para criar conta a receber.",
        amount,
        null,
        null,
        buildPreValidationPayload(
          "Valor mensal ausente ou inválido para criar conta a receber.",
        ),
      );
    }

    const [student, danceClass] = await Promise.all([
      getStudent(supabase, enrollment.student_id),
      getClass(supabase, enrollment.class_id),
    ]);
    const customerId = await ensureContaAzulCustomerForGuardian(
      enrollment.financial_guardian_id,
    );
    failureCustomerId = customerId;
    console.info("[CA RECEIVABLE] providerCustomerId", customerId);
    const dueDate = calculateDueDate(settings.default_due_day);
    failureDueDate = dueDate;
    failureAmount = amount;
    console.info("[CA RECEIVABLE] amount", amount);
    console.info("[CA RECEIVABLE] dueDate", dueDate);
    const competenceDate = enrollment.start_date ?? toDateString(new Date());
    const description = buildDescription(student);
    const observation = buildObservation(danceClass);
    const externalReference = `DK-ENROLLMENT-${enrollment.id}`;
    const endpoint = "/v1/financeiro/eventos-financeiros/contas-a-receber";
    console.info("[CA RECEIVABLE] endpoint", endpoint);
    const response = await new ContaAzulClient().createReceivable({
      customerId,
      amount,
      description,
      observation,
      competenceDate,
      dueDate,
      financialAccountId: settings.conta_azul_financial_account_id,
      revenueCategoryId: settings.conta_azul_revenue_category_id,
    });
    const protocolId = getProtocolId(response);
    const responseDiagnostics = getContaAzulResponseDiagnostics(response);
    const responsePayload = buildContaAzulRequestPayload(responseDiagnostics);

    if (!protocolId) {
      return await saveFailure(
        supabase,
        enrollment.id,
        enrollment.student_id,
        enrollment.financial_guardian_id,
        "create_receivable_event failed: resposta sem protocolId.",
        amount,
        customerId,
        dueDate,
        responsePayload,
      );
    }

    console.log("[CA RECEIVABLE] response status", responseDiagnostics?.status ?? null);
    console.log("[CA RECEIVABLE] body status", response.status ?? null);
    console.log("[CA RECEIVABLE] detected protocol", protocolId);

    await saveFinancialRecord(supabase, {
      enrollment_id: enrollment.id,
      student_id: enrollment.student_id,
      guardian_id: enrollment.financial_guardian_id,
      provider: CONTA_AZUL_PROVIDER,
      provider_customer_id: customerId,
      provider_protocol_id: protocolId,
      provider_receivable_id: null,
      external_reference: externalReference,
      provider_payload: responsePayload,
      amount,
      due_date: dueDate,
      status: "processing",
      error_message: null,
    });

    console.info("Conta Azul enrollment receivable event created:", {
      enrollmentId: enrollment.id,
      status: "processing",
      providerProtocolId: protocolId,
    });

    return {
      status: "processing",
      providerProtocolId: protocolId,
    };
  } catch (error) {
    failurePayload = buildFailurePayload(error);
    console.error("Conta Azul enrollment receivable failed:", {
      enrollmentId,
      status: "failed",
      message: getErrorMessage(error),
      payload: failurePayload,
    });

    try {
      return await saveFailure(
        supabase,
        enrollmentId,
        failureStudentId,
        failureGuardianId,
        getErrorMessage(error),
        failureAmount,
        failureCustomerId,
        failureDueDate,
        failurePayload,
      );
    } catch (recordError) {
      console.error("Conta Azul enrollment receivable failure record failed:", {
        enrollmentId,
        message: getErrorMessage(recordError),
      });

      return {
        status: "failed",
        message: getErrorMessage(error),
      };
    }
  }
}

async function getExistingReceivableOrProcessing(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
) {
  const { data, error } = await supabase
    .from("enrollment_financial_records")
    .select("id, provider_protocol_id, provider_receivable_id, status")
    .eq("enrollment_id", enrollmentId)
    .eq("provider", CONTA_AZUL_PROVIDER)
    .in("status", ["processing", "receivable_created"])
    .or("provider_protocol_id.not.is.null,provider_receivable_id.not.is.null")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getExistingContract(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
) {
  const { data, error } = await supabase
    .from("enrollment_financial_records")
    .select("id, provider_contract_id, status")
    .eq("enrollment_id", enrollmentId)
    .eq("provider", CONTA_AZUL_PROVIDER)
    .eq("status", "contract_created")
    .not("provider_contract_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getContaAzulSettings(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<FinanceProviderSettings | null> {
  const { data, error } = await supabase
    .from("finance_provider_settings")
    .select(
      "active, auto_create_receivable_on_enrollment, conta_azul_financial_account_id, conta_azul_financial_account_name, conta_azul_revenue_category_id, conta_azul_revenue_category_name, conta_azul_service_item_id, conta_azul_service_item_name, default_due_day",
    )
    .eq("provider", CONTA_AZUL_PROVIDER)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as FinanceProviderSettings | null) ?? null;
}

async function saveContaAzulServiceItem(
  supabase: ReturnType<typeof createAdminClient>,
  serviceId: string,
  serviceName: string,
) {
  const { error } = await supabase.from("finance_provider_settings").upsert(
    {
      provider: CONTA_AZUL_PROVIDER,
      conta_azul_service_item_id: serviceId,
      conta_azul_service_item_name: serviceName,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "provider",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

function getSkippedSettingsMessage(
  settings: FinanceProviderSettings | null,
  mode: CreateContaAzulReceivableOptions["mode"],
) {
  if (!settings) {
    return "Configuração financeira Conta Azul não encontrada.";
  }

  if (!settings.active) {
    return "Configuração financeira Conta Azul inativa.";
  }

  if (
    mode !== "manual" &&
    mode !== "contract" &&
    !settings.auto_create_receivable_on_enrollment
  ) {
    return "Criação automática de conta a receber desativada.";
  }

  return null;
}

async function getEnrollmentSnapshot(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
): Promise<EnrollmentSnapshot | null> {
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      "id, student_id, class_id, financial_guardian_id, monthly_amount, status, start_date, end_date, first_due_date, created_at",
    )
    .eq("id", enrollmentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as EnrollmentSnapshot | null) ?? null;
}

async function getStudent(
  supabase: ReturnType<typeof createAdminClient>,
  studentId: string | null,
): Promise<NamedRecord | null> {
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

  return (data as NamedRecord | null) ?? null;
}

async function getClass(
  supabase: ReturnType<typeof createAdminClient>,
  classId: string | null,
): Promise<NamedRecord | null> {
  if (!classId) {
    return null;
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, name, teacher_id, instructor_name")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const danceClass = data as
    | (NamedRecord & {
        teacher_id?: string | null;
        instructor_name?: string | null;
      })
    | null;

  if (!danceClass) {
    return null;
  }

  if (!danceClass?.teacher_id) {
    return {
      ...danceClass,
      teacher_name: danceClass?.instructor_name ?? null,
    };
  }

  const { data: teacher, error: teacherError } = await supabase
    .from("staff_members")
    .select("id, full_name, artistic_name")
    .eq("id", danceClass.teacher_id)
    .maybeSingle();

  if (teacherError) {
    throw new Error(teacherError.message);
  }

  return {
    ...danceClass,
    teacher_name:
      ((teacher?.artistic_name as string | null) ??
        (teacher?.full_name as string | null)) ??
      danceClass.instructor_name ??
      null,
  };
}

async function getGuardianDebug(
  supabase: ReturnType<typeof createAdminClient>,
  guardianId: string,
): Promise<GuardianDebugRecord | null> {
  const { data, error } = await supabase
    .from("guardians")
    .select("id, document, conta_azul_person_id")
    .eq("id", guardianId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GuardianDebugRecord | null) ?? null;
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

function calculateDueDate(defaultDueDay: number | null) {
  if (!defaultDueDay) {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return toDateString(date);
  }

  const today = new Date();
  const dueDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    clampDay(today.getFullYear(), today.getMonth(), defaultDueDay),
  );

  if (dueDate < startOfToday(today)) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    return toDateString(
      new Date(
        nextMonth.getFullYear(),
        nextMonth.getMonth(),
        clampDay(nextMonth.getFullYear(), nextMonth.getMonth(), defaultDueDay),
      ),
    );
  }

  return toDateString(dueDate);
}

function calculateFirstDueDate(defaultDueDay: number, baseDate = new Date()) {
  let dueDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    clampDay(baseDate.getFullYear(), baseDate.getMonth(), defaultDueDay),
  );

  if (dueDate < startOfToday(baseDate)) {
    const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
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

function startOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildDescription(student: NamedRecord | null) {
  return `Mensalidade DK Studio - ${student?.full_name ?? "Aluno"}`;
}

function buildMonthlyServiceDescription(student: NamedRecord | null) {
  return `Mensalidade DK Studio - ${student?.full_name ?? "Aluno"}`;
}

function buildContractObservation(
  student: NamedRecord | null,
  danceClass: NamedRecord | null,
) {
  return `Matrícula DK Studio - ${student?.full_name ?? "Aluno"} - ${
    danceClass?.name ?? "Turma"
  }`;
}

function buildObservation(danceClass: NamedRecord | null) {
  const className = danceClass?.name ?? "Turma";
  const teacherName = danceClass?.teacher_name ?? "Professor não informado";

  return `Matrícula ${className} - ${teacherName}`;
}

function getProtocolId(response: unknown) {
  if (!response || typeof response !== "object") {
    return null;
  }

  const body = response as {
    protocolId?: unknown;
    protocol_id?: unknown;
    protocolo?: unknown;
    id?: unknown;
    data?: {
      protocolId?: unknown;
      protocolo?: unknown;
      id?: unknown;
    };
    result?: {
      protocolId?: unknown;
      protocolo?: unknown;
      id?: unknown;
    };
  };

  return firstStringValue([
    body.protocolId,
    body.protocol_id,
    body.protocolo,
    body.id,
    body.data?.protocolId,
    body.data?.protocolo,
    body.data?.id,
    body.result?.protocolId,
    body.result?.protocolo,
    body.result?.id,
  ]);
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

function getSaleId(response: unknown) {
  if (!response || typeof response !== "object") {
    return null;
  }

  const body = response as {
    id_venda?: unknown;
    saleId?: unknown;
    sale_id?: unknown;
    data?: {
      id_venda?: unknown;
      saleId?: unknown;
      sale_id?: unknown;
    };
    result?: {
      id_venda?: unknown;
      saleId?: unknown;
      sale_id?: unknown;
    };
  };

  return firstStringValue([
    body.id_venda,
    body.saleId,
    body.sale_id,
    body.data?.id_venda,
    body.data?.saleId,
    body.data?.sale_id,
    body.result?.id_venda,
    body.result?.saleId,
    body.result?.sale_id,
  ]);
}

function firstStringValue(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function buildContaAzulRequestPayload(
  diagnostics: ReturnType<typeof getContaAzulResponseDiagnostics>,
) {
  if (!diagnostics) {
    return buildPreValidationPayload(
      "Resposta Conta Azul sem diagnóstico de requisição.",
    );
  }

  return {
    stage: diagnostics.stage ?? "create_receivable_event",
    endpoint: diagnostics.endpoint,
    method: diagnostics.method,
    status: diagnostics.status,
    response: diagnostics.body,
    body: diagnostics.body,
    sanitized_payload: diagnostics.sanitizedPayload,
  };
}

function buildPreValidationPayload(reason: string) {
  return {
    stage: "pre_validation",
    reason,
  };
}

async function saveFailure(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
  studentId: string | null,
  guardianId: string | null,
  message: string,
  amount: number | null = null,
  providerCustomerId: string | null = null,
  dueDate: string | null = null,
  providerPayload: unknown = buildPreValidationPayload(message),
  contractPayload: unknown = null,
): Promise<EnrollmentReceivableResult> {
  await saveFinancialRecord(supabase, {
    enrollment_id: enrollmentId,
    student_id: studentId,
    guardian_id: guardianId,
    provider: CONTA_AZUL_PROVIDER,
    provider_customer_id: providerCustomerId,
    amount,
    due_date: dueDate,
    provider_payload: providerPayload,
    contract_payload: contractPayload,
    status: "failed",
    error_message: message,
  });

  return {
    status: "failed",
    message,
  };
}

async function saveContractFailure(
  supabase: ReturnType<typeof createAdminClient>,
  enrollment: EnrollmentSnapshot,
  message: string,
  amount: number | null = null,
  providerCustomerId: string | null = null,
  dueDate: string | null = null,
  contractPayload: unknown = buildPreValidationPayload(message),
) {
  return saveFailure(
    supabase,
    enrollment.id,
    enrollment.student_id,
    enrollment.financial_guardian_id,
    message,
    amount,
    providerCustomerId,
    dueDate,
    null,
    contractPayload,
  );
}

async function saveFinancialRecord(
  supabase: ReturnType<typeof createAdminClient>,
  payload: RecordPayload,
) {
  const { data: existing, error: existingError } = await supabase
    .from("enrollment_financial_records")
    .select("id")
    .eq("enrollment_id", payload.enrollment_id)
    .eq("provider", payload.provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("enrollment_financial_records")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await supabase
    .from("enrollment_financial_records")
    .insert(payload);

  if (error) {
    throw new Error(error.message);
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível criar a conta a receber no Conta Azul.";
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
