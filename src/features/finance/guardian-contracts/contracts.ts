import "server-only";

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
  year: number;
  status: string;
  provider_contract_id: string | null;
  total_amount: number | string;
  start_date: string;
  end_date: string;
  first_due_date: string;
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
    .select(
      "id, guardian_id, provider, year, status, provider_contract_id, total_amount, start_date, end_date, first_due_date",
    )
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

    return existingContract as GuardianFinancialContract;
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
      status: "draft",
      total_amount: 0,
      start_date: input.startDate,
      end_date: input.endDate,
      first_due_date: input.firstDueDate,
    })
    .select(
      "id, guardian_id, provider, year, status, provider_contract_id, total_amount, start_date, end_date, first_due_date",
    )
    .single();

  if (createError || !createdContract) {
    throw new Error(createError?.message ?? "Contrato financeiro não criado.");
  }

  console.info("[GUARDIAN CONTRACT] contractFound", false);
  console.info("[GUARDIAN CONTRACT] contractCreated", createdContract.id);

  return createdContract as GuardianFinancialContract;
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
  const nextStatus = guardianContract.provider_contract_id ? "pending_sync" : "draft";
  const { error: updateError } = await supabase
    .from("guardian_financial_contracts")
    .update({
      total_amount: totalAmount,
      status: nextStatus,
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

  return (data as EnrollmentSnapshot | null) ?? null;
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

async function recalculateContractTotal(
  supabase: ReturnType<typeof createAdminClient>,
  guardianContractId: string,
) {
  const { data, error } = await supabase
    .from("guardian_financial_contract_items")
    .select("amount")
    .eq("guardian_contract_id", guardianContractId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((total, item) => {
    const amount =
      typeof item.amount === "number" ? item.amount : Number(item.amount ?? 0);

    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
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

  return (data as NamedRecord | null) ?? null;
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

  return (data as NamedRecord | null) ?? null;
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

  return (data as GuardianRecord | null) ?? null;
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

function buildDescription(
  student: NamedRecord | null,
  danceClass: NamedRecord | null,
) {
  return `Mensalidade DK Studio - ${student?.full_name ?? "Aluno"} - ${
    danceClass?.name ?? "Turma"
  }`;
}
