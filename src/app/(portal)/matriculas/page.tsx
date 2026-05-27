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
import { createManualContaAzulContractForEnrollmentAction } from "@/features/finance/conta-azul/enrollment-receivable-actions";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { TeacherOption } from "@/features/staff/types";
import { formatDate } from "@/features/students/formatters";

export const dynamic = "force-dynamic";

type MatriculasPageProps = {
  searchParams?: Promise<{
    created?: string;
    receivable?: string;
    contract?: string;
  }>;
};

const contractMessages: Record<string, string> = {
  created: "Contrato criado no Conta Azul.",
  "already-created":
    "Esta matrícula já possui contrato no Conta Azul.",
  failed: "Não foi possível criar contrato no Conta Azul.",
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
                      {formatFinancialGuardianName(
                        enrollment.financialGuardian?.full_name,
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatMoney(enrollment.monthly_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <ExternalFinancialStatus enrollment={enrollment} />
                    </td>
                    {canGenerateReceivable ? (
                      <td className="px-4 py-3">
                        {isExternalFinancialLocked(
                          enrollment.externalFinancialRecord?.status,
                        ) ? (
                          <span className="text-xs text-muted-foreground">
                            {enrollment.externalFinancialRecord?.status ===
                            "contract_created"
                              ? "Contrato criado"
                              : "Processando"}
                          </span>
                        ) : (
                          <form
                            action={
                              createManualContaAzulContractForEnrollmentAction
                            }
                          >
                            <input
                              type="hidden"
                              name="enrollmentId"
                              value={enrollment.id}
                            />
                            <button
                              type="submit"
                              className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                            >
                              {enrollment.externalFinancialRecord?.status ===
                              "failed"
                                ? "Tentar novamente"
                                : "Gerar contrato Conta Azul"}
                            </button>
                          </form>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={canGenerateReceivable ? 10 : 9}
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
    ] = await Promise.all([
      supabase
        .from("enrollments")
        .select(
          "id, student_id, class_id, status, start_date, end_date, financial_guardian_id, monthly_amount, discount_amount, discount_reason, cancellation_reason, cancelled_at",
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
    ]);

    const firstError =
      error ??
      studentsError ??
      classesError ??
      guardiansError ??
      teachersError ??
      financialRecordsError;

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

    return (enrollments ?? []).map((enrollment) => ({
      id: enrollment.id as string,
      status: enrollment.status as EnrollmentListRow["status"],
      start_date: (enrollment.start_date as string | null) ?? null,
      end_date: (enrollment.end_date as string | null) ?? null,
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
    }));
  } catch (error) {
    console.error(
      "Enrollments list load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function ExternalFinancialStatus({
  enrollment,
}: {
  enrollment: EnrollmentListRow;
}) {
  const record = enrollment.externalFinancialRecord;

  if (!record) {
    return <span className="text-sm text-muted-foreground">Não gerado</span>;
  }

  const statusLabel =
    record.status === "contract_created"
      ? "Contrato criado"
      : record.status === "receivable_created"
        ? "Gerada"
      : record.status === "processing"
        ? "Processando"
      : record.status === "failed"
        ? "Falhou"
        : record.status === "skipped"
          ? "Ignorada"
          : record.status;

  return (
    <div className="space-y-1 text-sm">
      <div className="font-medium text-foreground">{statusLabel}</div>
      {record.provider_contract_id ||
      record.provider_receivable_id ||
      record.provider_protocol_id ? (
        <div className="font-mono text-xs text-muted-foreground">
          {record.provider_contract_id ??
            record.provider_receivable_id ??
            record.provider_protocol_id}
        </div>
      ) : null}
      <div className="text-xs text-muted-foreground">
        {formatMoney(record.amount)} · {formatDate(record.due_date)}
      </div>
      {record.error_message ? (
        <div className="max-w-[260px] text-xs text-red-600">
          {record.error_message}
        </div>
      ) : null}
    </div>
  );
}

function isExternalFinancialLocked(status: string | undefined) {
  return status === "contract_created" || status === "processing";
}
