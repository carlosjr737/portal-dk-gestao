import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  formatEnrollmentStatus,
  formatFinancialGuardianName,
  formatMoney,
} from "@/features/enrollments/formatters";
import type { EnrollmentListRow } from "@/features/enrollments/types";
import { syncGuardianContractAction } from "@/features/finance/conta-azul/enrollment-receivable-actions";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { TeacherOption } from "@/features/staff/types";
import { formatDate } from "@/features/students/formatters";

export const dynamic = "force-dynamic";

type MatriculasPageProps = {
  searchParams?: Promise<{
    created?: string;
    receivable?: string;
    contract?: string;
    guardianContract?: string;
  }>;
};

const contractMessages: Record<string, string> = {
  created: "Contrato consolidado enviado ao Conta Azul com sucesso.",
  "already-created": "Este contrato consolidado já existe no Conta Azul.",
  failed: "Não foi possível sincronizar o contrato consolidado no Conta Azul.",
  unauthorized: "Acesso não autorizado.",
};

export default async function MatriculasPage({
  searchParams,
}: MatriculasPageProps) {
  const params = await searchParams;
  const [enrollments, profile] = await Promise.all([
    getEnrollments(),
    getCurrentProfile(),
  ]);
  const canGenerateReceivable = profile?.active && profile.role === "admin";

  console.log(
    "[ENROLLMENTS LIST CONTRACT DEBUG]",
    enrollments.slice(0, 5).map((enrollment) => ({
      enrollmentId: enrollment.id,
      guardianContractItemId: enrollment.guardianContractItemId,
      guardianContractId: enrollment.guardianContractId,
      guardianContractStatus: enrollment.guardianContractStatus,
      guardianContractProviderContractId:
        enrollment.guardianContractProviderContractId,
      guardianContractTotalAmount: enrollment.guardianContractTotalAmount,
    })),
  );

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Matrículas"
          description="Gestão de vínculos entre alunos e turmas."
        />
        <Link
          href="/matriculas/nova"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Nova matrícula
        </Link>
      </div>

      {params?.created === "without-financial-guardian" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Matrícula criada sem responsável financeiro.
        </div>
      ) : null}

      {params?.created === "1" ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Matrícula criada com sucesso.
        </div>
      ) : null}

      {params?.created === "conta-azul-contract-failed" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Matrícula criada, mas o contrato no Conta Azul não foi gerado.
        </div>
      ) : null}

      {params?.contract ? (
        <div
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            params.contract === "created" ||
            params.contract === "already-created"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {contractMessages[params.contract] ??
            "Não foi possível criar contrato no Conta Azul."}
        </div>
      ) : null}

      {params?.guardianContract === "failed" ||
      params?.guardianContract === "sync_failed" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Não foi possível sincronizar o contrato consolidado com o Conta
          Azul. Verifique os logs.
        </div>
      ) : null}

      {params?.guardianContract === "auto_sync_failed" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Matrícula criada, mas houve falha ao sincronizar o contrato com o
          Conta Azul.
        </div>
      ) : null}

      {params?.guardianContract === "synced" ||
      params?.guardianContract === "sync_success" ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Contrato consolidado sincronizado com o Conta Azul com sucesso.
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Aluno</th>
                <th className="px-4 py-3 font-semibold">Turma</th>
                <th className="px-4 py-3 font-semibold">Professor</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Início</th>
                <th className="px-4 py-3 font-semibold">Data final</th>
                <th className="px-4 py-3 font-semibold">1º vencimento</th>
                <th className="px-4 py-3 font-semibold">Resp. financeiro</th>
                <th className="px-4 py-3 font-semibold">Valor mensal</th>
                <th className="px-4 py-3 font-semibold">Conta Azul</th>
                {canGenerateReceivable ? (
                  <th className="px-4 py-3 font-semibold">Ação</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrollments.length > 0 ? (
                enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      {enrollment.student ? (
                        <Link
                          href={`/alunos/${enrollment.student.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {enrollment.student.full_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          Aluno não encontrado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {enrollment.class ? (
                        <Link
                          href={`/turmas/${enrollment.class.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {enrollment.class.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          Turma não encontrada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {enrollment.class?.teacherName ?? "Não informado"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatEnrollmentStatus(enrollment.status)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(enrollment.start_date)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(enrollment.end_date)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(enrollment.first_due_date)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatFinancialGuardianName(
                        enrollment.financialGuardian?.full_name,
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatMoney(enrollment.monthly_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <ConsolidatedContractStatus enrollment={enrollment} />
                    </td>
                    {canGenerateReceivable ? (
                      <td className="px-4 py-3">
                        {shouldShowGuardianContractSync(enrollment) ? (
                          <form action={syncGuardianContractAction}>
                            <input
                              type="hidden"
                              name="guardianContractId"
                              value={enrollment.guardianContractId ?? ""}
                            />
                            <button
                              type="submit"
                              className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                            >
                              {getGuardianContractSyncButtonLabel(enrollment)}
                            </button>
                          </form>
                        ) : enrollment.guardianContractStatus === "active" ? (
                          <span className="text-xs text-muted-foreground">
                            Contrato ativo
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sem contrato consolidado
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={canGenerateReceivable ? 11 : 10}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma matrícula encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function getCurrentProfile() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  return getProfileByUserId(user.id);
}

async function getEnrollments(): Promise<EnrollmentListRow[]> {
  try {
    const supabase = await createClient();
    const [
      { data: enrollments, error },
      { data: students, error: studentsError },
      { data: classes, error: classesError },
      { data: guardians, error: guardiansError },
      { data: teachers, error: teachersError },
      { data: financialRecords, error: financialRecordsError },
      { data: guardianContractItems, error: guardianContractItemsError },
      { data: guardianContracts, error: guardianContractsError },
    ] = await Promise.all([
      supabase
        .from("enrollments")
        .select(
          "id, student_id, class_id, status, start_date, end_date, first_due_date, financial_guardian_id, monthly_amount, discount_amount, discount_reason, cancellation_reason, cancelled_at",
        )
        .order("created_at", { ascending: false }),
      supabase.from("students").select("id, full_name"),
      supabase.from("classes").select("id, name, teacher_id, instructor_name"),
      supabase.from("guardians").select("id, full_name"),
      supabase
        .from("staff_members")
        .select("id, full_name, artistic_name")
        .eq("role", "professor"),
      supabase
        .from("enrollment_financial_records")
        .select(
          "id, enrollment_id, status, provider_protocol_id, provider_receivable_id, provider_contract_id, amount, due_date, error_message, created_at",
        )
        .eq("provider", "conta_azul")
        .order("created_at", { ascending: false }),
      supabase
        .from("guardian_financial_contract_items")
        .select("id, enrollment_id, guardian_contract_id"),
      supabase
        .from("guardian_financial_contracts")
        .select("id, status, provider_contract_id, total_amount, version, error_message"),
    ]);

    const firstError =
      error ??
      studentsError ??
      classesError ??
      guardiansError ??
      teachersError ??
      financialRecordsError ??
      guardianContractItemsError ??
      guardianContractsError;

    if (firstError) {
      console.error("Enrollments list load error:", firstError.message);
      return [];
    }

    const studentsById = new Map(
      (students ?? []).map((student) => [
        student.id as string,
        { id: student.id as string, full_name: student.full_name as string },
      ]),
    );
    const teachersById = new Map(
      ((teachers ?? []) as TeacherOption[]).map((teacher) => [
        teacher.id,
        teacher,
      ]),
    );
    const classesById = new Map(
      (classes ?? []).map((danceClass) => {
        const teacher =
          typeof danceClass.teacher_id === "string"
            ? teachersById.get(danceClass.teacher_id)
            : null;

        return [
          danceClass.id as string,
          {
            id: danceClass.id as string,
            name: danceClass.name as string,
            teacherName: teacher
              ? getStaffDisplayName(teacher)
              : ((danceClass.instructor_name as string | null) ?? null),
          },
        ];
      }),
    );
    const guardiansById = new Map(
      (guardians ?? []).map((guardian) => [
        guardian.id as string,
        { id: guardian.id as string, full_name: guardian.full_name as string },
      ]),
    );
    const financialRecordsByEnrollmentId = new Map<
      string,
      EnrollmentListRow["externalFinancialRecord"]
    >();
    const guardianContractItemsByEnrollmentId = new Map<
      string,
      {
        itemId: string;
        guardianContractId: string;
      }
    >();
    const guardianContractsById = new Map<
      string,
      Omit<NonNullable<EnrollmentListRow["guardianFinancialContract"]>, "item_id">
    >();

    for (const record of financialRecords ?? []) {
      const enrollmentId = record.enrollment_id as string;

      if (!financialRecordsByEnrollmentId.has(enrollmentId)) {
        financialRecordsByEnrollmentId.set(enrollmentId, {
          status: record.status as string,
          provider_protocol_id:
            (record.provider_protocol_id as string | null) ?? null,
          provider_receivable_id:
            (record.provider_receivable_id as string | null) ?? null,
          provider_contract_id:
            (record.provider_contract_id as string | null) ?? null,
          amount:
            typeof record.amount === "number"
              ? record.amount
              : record.amount
                ? Number(record.amount)
                : null,
          due_date: (record.due_date as string | null) ?? null,
          error_message: (record.error_message as string | null) ?? null,
        });
      }
    }

    for (const contract of guardianContracts ?? []) {
      const contractId = contract.id as string | null;

      if (!contractId) {
        continue;
      }

      guardianContractsById.set(contractId, {
        id: contractId,
        status: String(contract.status ?? ""),
        provider_contract_id:
          (contract.provider_contract_id as string | null) ?? null,
        total_amount:
          typeof contract.total_amount === "number"
            ? contract.total_amount
            : contract.total_amount
              ? Number(contract.total_amount)
              : null,
        version:
          typeof contract.version === "number"
            ? contract.version
            : contract.version
              ? Number(contract.version)
              : null,
        error_message: (contract.error_message as string | null) ?? null,
      });
    }

    for (const item of guardianContractItems ?? []) {
      const enrollmentId = item.enrollment_id as string | null;
      const guardianContractId = item.guardian_contract_id as string | null;

      if (!enrollmentId || !guardianContractId || !item.id) {
        continue;
      }

      guardianContractItemsByEnrollmentId.set(enrollmentId, {
        itemId: item.id as string,
        guardianContractId,
      });
    }

    return (enrollments ?? []).map((enrollment) => {
      const contractItem = guardianContractItemsByEnrollmentId.get(
        enrollment.id as string,
      );
      const contract = contractItem
        ? guardianContractsById.get(contractItem.guardianContractId)
        : null;

      return {
      id: enrollment.id as string,
      status: enrollment.status as EnrollmentListRow["status"],
      start_date: (enrollment.start_date as string | null) ?? null,
      end_date: (enrollment.end_date as string | null) ?? null,
      first_due_date: (enrollment.first_due_date as string | null) ?? null,
      financial_guardian_id:
        (enrollment.financial_guardian_id as string | null) ?? null,
      monthly_amount:
        typeof enrollment.monthly_amount === "number"
          ? enrollment.monthly_amount
          : enrollment.monthly_amount
            ? Number(enrollment.monthly_amount)
            : null,
      discount_amount:
        typeof enrollment.discount_amount === "number"
          ? enrollment.discount_amount
          : enrollment.discount_amount
            ? Number(enrollment.discount_amount)
            : null,
      discount_reason: (enrollment.discount_reason as string | null) ?? null,
      cancellation_reason:
        (enrollment.cancellation_reason as string | null) ?? null,
      cancelled_at: (enrollment.cancelled_at as string | null) ?? null,
      guardianContractItemId: contractItem?.itemId ?? null,
      guardianContractId: contractItem?.guardianContractId ?? null,
      guardianContractStatus: contract?.status ?? null,
      guardianContractProviderContractId:
        contract?.provider_contract_id ?? null,
      guardianContractTotalAmount: contract?.total_amount ?? null,
      student: studentsById.get(enrollment.student_id as string) ?? null,
      class: classesById.get(enrollment.class_id as string) ?? null,
      financialGuardian:
        guardiansById.get(enrollment.financial_guardian_id as string) ?? null,
      externalFinancialRecord:
        financialRecordsByEnrollmentId.get(enrollment.id as string) ?? null,
      guardianFinancialContract:
        contract && contractItem
          ? {
              ...contract,
              item_id: contractItem.itemId,
            }
          : null,
      };
    });
  } catch (error) {
    console.error(
      "Enrollments list load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function ConsolidatedContractStatus({
  enrollment,
}: {
  enrollment: EnrollmentListRow;
}) {
  if (!enrollment.guardianContractId) {
    return (
      <span className="text-sm text-muted-foreground">
        Contrato consolidado não criado
      </span>
    );
  }

  const statusLabel =
    enrollment.guardianContractStatus === "draft" &&
    !enrollment.guardianContractProviderContractId
      ? "Contrato consolidado pendente"
      : enrollment.guardianContractStatus === "active" &&
          enrollment.guardianContractProviderContractId
        ? "Contrato consolidado ativo"
        : enrollment.guardianContractStatus === "pending_replacement"
          ? "Pendente de sincronização"
          : enrollment.guardianContractStatus === "sync_failed"
            ? "Falha na sincronização"
            : enrollment.guardianContractStatus ?? "Contrato consolidado";

  return (
    <div className="space-y-1 text-sm">
      <div className="font-medium text-foreground">{statusLabel}</div>
      {enrollment.guardianContractProviderContractId ? (
        <div className="font-mono text-xs text-muted-foreground">
          {enrollment.guardianContractProviderContractId}
        </div>
      ) : null}
      <div className="text-xs text-muted-foreground">
        {formatMoney(enrollment.guardianContractTotalAmount)} · v
        {enrollment.guardianFinancialContract?.version ?? 1}
      </div>
      {enrollment.guardianFinancialContract?.error_message ? (
        <div className="max-w-[260px] text-xs text-red-600">
          {enrollment.guardianFinancialContract.error_message}
        </div>
      ) : null}
    </div>
  );
}

function shouldShowGuardianContractSync(enrollment: EnrollmentListRow) {
  return (
    (enrollment.guardianContractStatus === "draft" &&
      !enrollment.guardianContractProviderContractId) ||
    enrollment.guardianContractStatus === "pending_replacement" ||
    enrollment.guardianContractStatus === "sync_failed"
  );
}

function getGuardianContractSyncButtonLabel(enrollment: EnrollmentListRow) {
  const status = enrollment.guardianContractStatus;

  if (status === "pending_replacement") {
    return "Sincronizar atualização";
  }

  if (status === "sync_failed") {
    return "Tentar novamente";
  }

  return "Sincronizar";
}
