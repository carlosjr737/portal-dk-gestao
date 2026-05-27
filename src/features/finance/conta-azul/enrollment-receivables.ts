import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ContaAzulClient } from "@/features/finance/conta-azul/client";
import { ensureContaAzulCustomerForGuardian } from "@/features/finance/conta-azul/guardian-links";

const CONTA_AZUL_PROVIDER = "conta_azul";

type EnrollmentReceivableResult = {
  status: "skipped" | "receivable_created" | "failed" | "already_created";
  message?: string;
  providerReceivableId?: string;
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
};

type RecordPayload = {
  enrollment_id: string;
  student_id: string | null;
  guardian_id: string | null;
  provider: typeof CONTA_AZUL_PROVIDER;
  provider_customer_id?: string | null;
  provider_receivable_id?: string | null;
  provider_payload?: unknown;
  amount?: number | null;
  due_date?: string | null;
  status: "skipped" | "receivable_created" | "failed";
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

  try {
    supabase = createAdminClient();
  } catch (error) {
    return {
      status: "failed",
      message: getErrorMessage(error),
    };
  }

  try {
    const existingReceivable = await getExistingCreatedReceivable(
      supabase,
      enrollmentId,
    );

    if (existingReceivable) {
      return {
        status: "already_created",
        providerReceivableId: existingReceivable.provider_receivable_id as string,
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

    const skippedMessage = getSkippedSettingsMessage(settings, mode);

    if (skippedMessage) {
      await saveFinancialRecord(supabase, {
        enrollment_id: enrollment.id,
        student_id: enrollment.student_id,
        guardian_id: enrollment.financial_guardian_id,
        provider: CONTA_AZUL_PROVIDER,
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
      );
    }

    if (!settings.conta_azul_revenue_category_id) {
      return await saveFailure(
        supabase,
        enrollment.id,
        enrollment.student_id,
        enrollment.financial_guardian_id,
        "Categoria de receita Conta Azul não configurada.",
      );
    }

    if (mode === "manual" && !settings.default_due_day) {
      return await saveFailure(
        supabase,
        enrollment.id,
        enrollment.student_id,
        enrollment.financial_guardian_id,
        "Dia padrão de vencimento não configurado.",
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
        status: "skipped",
        error_message: message,
      });

      return {
        status: "skipped",
        message,
      };
    }

    const amount = normalizeAmount(enrollment.monthly_amount);

    if (!amount || amount <= 0) {
      return await saveFailure(
        supabase,
        enrollment.id,
        enrollment.student_id,
        enrollment.financial_guardian_id,
        "Valor mensal ausente ou inválido para criar conta a receber.",
        amount,
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
    const dueDate = calculateDueDate(settings.default_due_day);
    failureDueDate = dueDate;
    failureAmount = amount;
    const competenceDate = enrollment.start_date ?? toDateString(new Date());
    const description = buildDescription(student, danceClass);
    const response = await new ContaAzulClient().createReceivable({
      customerId,
      amount,
      description,
      competenceDate,
      dueDate,
      financialAccountId: settings.conta_azul_financial_account_id,
      revenueCategoryId: settings.conta_azul_revenue_category_id,
    });

    await saveFinancialRecord(supabase, {
      enrollment_id: enrollment.id,
      student_id: enrollment.student_id,
      guardian_id: enrollment.financial_guardian_id,
      provider: CONTA_AZUL_PROVIDER,
      provider_customer_id: customerId,
      provider_receivable_id: response.id,
      provider_payload: response,
      amount,
      due_date: dueDate,
      status: "receivable_created",
      error_message: null,
    });

    console.info("Conta Azul enrollment receivable created:", {
      enrollmentId: enrollment.id,
      status: "receivable_created",
      providerReceivableId: response.id,
    });

    return {
      status: "receivable_created",
      providerReceivableId: response.id,
    };
  } catch (error) {
    console.error("Conta Azul enrollment receivable failed:", {
      enrollmentId,
      status: "failed",
      message: getErrorMessage(error),
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

async function getExistingCreatedReceivable(
  supabase: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
) {
  const { data, error } = await supabase
    .from("enrollment_financial_records")
    .select("id, provider_receivable_id")
    .eq("enrollment_id", enrollmentId)
    .eq("provider", CONTA_AZUL_PROVIDER)
    .eq("status", "receivable_created")
    .not("provider_receivable_id", "is", null)
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
    .select("id, name")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as NamedRecord | null) ?? null;
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

function buildDescription(student: NamedRecord | null, danceClass: NamedRecord | null) {
  return `Mensalidade DK Studio - ${student?.full_name ?? "Aluno"} - ${
    danceClass?.name ?? "Turma"
  }`;
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
): Promise<EnrollmentReceivableResult> {
  await saveFinancialRecord(supabase, {
    enrollment_id: enrollmentId,
    student_id: studentId,
    guardian_id: guardianId,
    provider: CONTA_AZUL_PROVIDER,
    provider_customer_id: providerCustomerId,
    amount,
    due_date: dueDate,
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
