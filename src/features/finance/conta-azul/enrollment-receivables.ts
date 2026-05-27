import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ContaAzulApiError,
  ContaAzulClient,
  getContaAzulResponseDiagnostics,
} from "@/features/finance/conta-azul/client";
import { ensureContaAzulCustomerForGuardian } from "@/features/finance/conta-azul/guardian-links";

const CONTA_AZUL_PROVIDER = "conta_azul";

type EnrollmentReceivableResult = {
  status:
    | "skipped"
    | "processing"
    | "receivable_created"
    | "failed"
    | "already_created";
  message?: string;
  providerReceivableId?: string;
  providerProtocolId?: string;
};

type CreateContaAzulReceivableOptions = {
  mode?: "automatic" | "manual";
};

type FinanceProviderSettings = {
  active: boolean | null;
  auto_create_receivable_on_enrollment: boolean | null;
  conta_azul_financial_account_id: string | null;
  conta_azul_financial_account_name?: string | null;
  conta_azul_revenue_category_id: string | null;
  conta_azul_revenue_category_name?: string | null;
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
  external_reference?: string | null;
  provider_payload?: unknown;
  amount?: number | null;
  due_date?: string | null;
  status: "skipped" | "processing" | "receivable_created" | "failed";
  error_message?: string | null;
};

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

async function getContaAzulSettings(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<FinanceProviderSettings | null> {
  const { data, error } = await supabase
    .from("finance_provider_settings")
    .select(
      "active, auto_create_receivable_on_enrollment, conta_azul_financial_account_id, conta_azul_financial_account_name, conta_azul_revenue_category_id, conta_azul_revenue_category_name, default_due_day",
    )
    .eq("provider", CONTA_AZUL_PROVIDER)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as FinanceProviderSettings | null) ?? null;
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

  if (mode !== "manual" && !settings.auto_create_receivable_on_enrollment) {
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
      "id, student_id, class_id, financial_guardian_id, monthly_amount, status, start_date, created_at",
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

function clampDay(year: number, month: number, day: number) {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

function startOfToday(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDescription(student: NamedRecord | null) {
  return `Mensalidade DK Studio - ${student?.full_name ?? "Aluno"}`;
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

function firstStringValue(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
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
    status: "failed",
    error_message: message,
  });

  return {
    status: "failed",
    message,
  };
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
