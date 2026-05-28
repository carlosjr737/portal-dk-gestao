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
import { syncGuardianFinancialContractAction } from "@/features/finance/conta-azul/enrollment-receivable-actions";
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

      {params?.guardianContract === "failed" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Não foi possível registrar ou sincronizar o contrato financeiro
          consolidado do responsável. Verifique os logs e tente novamente.
        </div>
      ) : null}

      {params?.guardianContract === "synced" ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Contrato consolidado sincronizado com o Conta Azul.
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
                          <form action={syncGuardianFinancialContractAction}>
                            <input
                              type="hidden"
                              name="guardianContractId"
                              value={enrollment.guardianFinancialContract?.id}
                            />
                            <input
                              type="hidden"
                              name="mode"
                              value={
                                enrollment.guardianFinancialContract
                                  ?.provider_contract_id
                                  ? "replace"
                                  : "create"
                              }
                            />
                            <button
                              type="submit"
                              className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                            >
                              {enrollment.externalFinancialRecord?.status ===
                                "failed" ||
                              enrollment.guardianFinancialContract?.status ===
                                "sync_failed"
                                ? "Tentar sincronizar novamente"
                                : "Sincronizar contrato consolidado"}
                            </button>
                          </form>
                        ) : enrollment.guardianFinancialContract?.status ===
                          "active" ? (
                          <span className="text-xs text-muted-foreground">
                            Contrato ativo
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Aguardando contrato consolidado
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
        .from("guardian_financial_contracts")
        .select(
          "id, guardian_id, year, status, provider_contract_id, total_amount, version, error_message",
        )
        .eq("provider", "conta_azul"),
    ]);

    const firstError =
      error ??
      studentsError ??
      classesError ??
      guardiansError ??
      teachersError ??
      financialRecordsError ??
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
    const guardianContractsByGuardianYear = new Map<
      string,
      EnrollmentListRow["guardianFinancialContract"]
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
      const guardianId = contract.guardian_id as string | null;
      const year = contract.year as number | null;

      if (!guardianId || !year) {
        continue;
      }

      guardianContractsByGuardianYear.set(`${guardianId}:${year}`, {
        id: contract.id as string,
        status: contract.status as string,
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

    return (enrollments ?? []).map((enrollment) => ({
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
      student: studentsById.get(enrollment.student_id as string) ?? null,
      class: classesById.get(enrollment.class_id as string) ?? null,
      financialGuardian:
        guardiansById.get(enrollment.financial_guardian_id as string) ?? null,
      externalFinancialRecord:
        financialRecordsByEnrollmentId.get(enrollment.id as string) ?? null,
      guardianFinancialContract:
        guardianContractsByGuardianYear.get(
          `${String(enrollment.financial_guardian_id ?? "")}:${getYear(
            enrollment.start_date as string | null,
          )}`,
        ) ?? null,
    }));
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
  const contract = enrollment.guardianFinancialContract;

  if (!contract) {
    return (
      <span className="text-sm text-muted-foreground">
        Contrato consolidado não criado
      </span>
    );
  }

  const statusLabel =
    contract.status === "active"
      ? "Contrato ativo"
      : contract.status === "pending_replacement"
        ? "Contrato consolidado pendente de sincronização no Conta Azul."
        : contract.status === "sync_failed"
          ? "Falha na sincronização"
          : contract.status === "draft"
            ? "Contrato consolidado em rascunho"
            : contract.status;

  return (
    <div className="space-y-1 text-sm">
      <div className="font-medium text-foreground">{statusLabel}</div>
      {contract.provider_contract_id ? (
        <div className="font-mono text-xs text-muted-foreground">
          {contract.provider_contract_id}
        </div>
      ) : null}
      <div className="text-xs text-muted-foreground">
        {formatMoney(contract.total_amount)} · v{contract.version ?? 1}
      </div>
      {contract.error_message ? (
        <div className="max-w-[260px] text-xs text-red-600">
          {contract.error_message}
        </div>
      ) : null}
    </div>
  );
}

function shouldShowGuardianContractSync(enrollment: EnrollmentListRow) {
  const contract = enrollment.guardianFinancialContract;

  return (
    contract?.status === "draft" ||
    contract?.status === "pending_replacement" ||
    contract?.status === "sync_failed"
  );
}

function getYear(date: string | null) {
  if (!date) {
    return "";
  }

  return String(date).slice(0, 4);
}
