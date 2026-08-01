import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  formatEnrollmentStatus,
  formatFinancialGuardianName,
  formatMoney,
} from "@/features/enrollments/formatters";
import type { EnrollmentListRow } from "@/features/enrollments/types";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { TeacherOption } from "@/features/staff/types";
import { formatDate } from "@/features/students/formatters";
import { CobrancaAlunoButton } from "@/features/baas/cobranca-aluno-button";
import { buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableRow,
  TableHead,
  TableHeader,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type MatriculasPageProps = {
  searchParams?: Promise<{
    created?: string;
  }>;
};

export default async function MatriculasPage({
  searchParams,
}: MatriculasPageProps) {
  const params = await searchParams;
  const [enrollments, cobrancas, usaPagamentos] = await Promise.all([
    getEnrollments(),
    getCobrancasPorContrato(),
    escolaUsaPagamentos(),
  ]);
  // Colunas visíveis variam por escola: quem não optou pelo módulo de
  // pagamento não vê a coluna "Cobrança" — fica com a tela limpa.
  const colunas = 9 + (usaPagamentos ? 1 : 0);


  return (
    <div>
      <PageHeader
        title="Matrículas"
        description="Gestão de vínculos entre alunos e turmas."
        actions={
          <>
            <Link
              href="/matriculas/nova"
              className={buttonVariants()}
            >
              Nova matrícula
            </Link>
          </>
        }
      />

      {params?.created === "without-financial-guardian" ? (
        <Alert tone="warning" className="mt-4">
          Matrícula criada sem responsável financeiro.
        </Alert>
      ) : null}

      {params?.created === "1" ? (
        <Alert tone="success" className="mt-4">
          Matrícula criada com sucesso.
        </Alert>
      ) : null}

      <Table
        containerClassName="mt-6"
        minWidth="1240px"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Turma</TableHead>
            <TableHead>Professor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Data final</TableHead>
            <TableHead>1º vencimento</TableHead>
            <TableHead>Resp. financeiro</TableHead>
            <TableHead>Valor mensal</TableHead>
            {usaPagamentos ? (
              <TableHead>Cobrança</TableHead>
            ) : null}

          </TableRow>
        </TableHeader>
        <TableBody>
          {enrollments.length > 0 ? (
            enrollments.map((enrollment) => (
              <TableRow key={enrollment.id}>
                <TableCell>
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
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {enrollment.class?.teacherName ?? "Não informado"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatEnrollmentStatus(enrollment.status)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(enrollment.start_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(enrollment.end_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(enrollment.first_due_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFinancialGuardianName(
                    enrollment.financialGuardian?.full_name,
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatMoney(enrollment.monthly_amount)}
                </TableCell>
                {usaPagamentos ? (
                <TableCell>
                  {(() => {
                    const c = enrollment.guardianContractId
                      ? cobrancas.get(enrollment.guardianContractId)
                      : undefined;

                    // Cobrança já existente aparece mesmo em matrícula
                    // cancelada — o histórico importa.
                    if (c && enrollment.guardianContractId) {
                      return (
                        <CobrancaAlunoButton
                          contratoId={enrollment.guardianContractId}
                          valor={enrollment.guardianContractTotalAmount ?? null}
                          jaTemCobranca
                          statusCobranca={c.status}
                          proximoVencimento={c.proximo_vencimento}
                        />
                      );
                    }

                    // Não oferece cobrar quem não está estudando.
                    if (enrollment.status !== "active") {
                      return (
                        <span className="text-xs text-muted-foreground">—</span>
                      );
                    }

                    if (!enrollment.guardianContractId) {
                      return (
                        <span className="text-xs text-muted-foreground">
                          Sem contrato
                        </span>
                      );
                    }

                    return (
                      <CobrancaAlunoButton
                        contratoId={enrollment.guardianContractId}
                        valor={enrollment.guardianContractTotalAmount ?? null}
                        jaTemCobranca={false}
                      />
                    );
                  })()}
                </TableCell>
                ) : null}
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={colunas}>Nenhuma matrícula encontrada.</TableEmpty>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

type CobrancaResumo = { status: string; proximo_vencimento: string | null };

/** Cobranças recorrentes já criadas, indexadas pelo contrato do responsável. */
async function getCobrancasPorContrato(): Promise<Map<string, CobrancaResumo>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aluno_assinatura")
    .select("guardian_contract_id, status, proximo_vencimento");

  return new Map(
    (data ?? []).map((c) => [
      c.guardian_contract_id as string,
      {
        status: c.status as string,
        proximo_vencimento: (c.proximo_vencimento as string | null) ?? null,
      },
    ]),
  );
}

/**
 * A escola optou por cobrar os alunos pelo sistema?
 *
 * Muita escola vai querer só a gestão (alunos, turmas, chamada) e continuar
 * cobrando por fora. Para essas, a coluna de cobrança nem aparece.
 */
async function escolaUsaPagamentos(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("school")
    .select("usa_pagamentos")
    .maybeSingle();
  return Boolean(data?.usa_pagamentos);
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
