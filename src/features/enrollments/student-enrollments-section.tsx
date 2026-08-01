"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelEnrollment } from "@/features/enrollments/actions";
import { CancelEnrollmentModal } from "@/features/enrollments/cancel-enrollment-modal";
import {
  formatEnrollmentStatus,
  formatFinancialGuardianName,
  formatMoney,
} from "@/features/enrollments/formatters";
import type { EnrollmentStatus } from "@/features/enrollments/schemas";
import {
  formatDate,
  formatDateTime,
  formatText,
} from "@/features/students/formatters";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export type StudentEnrollmentItem = {
  id: string;
  status: EnrollmentStatus;
  start_date: string | null;
  end_date: string | null;
  monthly_amount: number | null;
  financialGuardianName: string | null;
  cancellation_reason: string | null;
  cancellation_notes: string | null;
  cancelled_at: string | null;
  class: {
    id: string;
    name: string;
    category: string | null;
    teacherName: string | null;
  };
};

type StudentEnrollmentsSectionProps = {
  enrollments: StudentEnrollmentItem[];
  loadError?: string | null;
};

export function StudentEnrollmentsSection({
  enrollments,
  loadError,
}: StudentEnrollmentsSectionProps) {
  const router = useRouter();
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<
    string | null
  >(null);

  async function handleConfirm(payload: {
    enrollmentId: string;
    cancellationReason: string;
    cancellationNotes?: string;
  }) {
    const formData = new FormData();
    formData.set("enrollment_id", payload.enrollmentId);
    formData.set("cancellation_reason", payload.cancellationReason);
    formData.set("cancellation_notes", payload.cancellationNotes ?? "");

    const result = await cancelEnrollment({}, formData);

    if (!result.success) {
      throw new Error(result.message ?? "Não foi possível cancelar a matrícula.");
    }

    router.refresh();
  }

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-md border border-border bg-white">
      <div className="border-b border-border p-5">
        <h2 className="text-base font-semibold text-foreground">
          Matrículas do aluno
        </h2>
      </div>
      {loadError ? (
        <Alert tone="warning" className="border-b px-5">
          Não foi possível carregar as matrículas do aluno.
        </Alert>
      ) : null}
      {/* w-auto min-w-full: com 9 colunas, largura fixa espremeria as células
          em vez de deixar rolar na horizontal. */}
      <Table
        containerClassName="rounded-none border-0"
        className="w-auto min-w-full"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Turma</TableHead>
            <TableHead>Modalidade</TableHead>
            <TableHead>Professor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Final</TableHead>
            <TableHead>Resp. financeiro</TableHead>
            <TableHead>Valor mensal</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enrollments.length > 0 ? (
            enrollments.map((enrollment) => (
              <TableRow key={enrollment.id}>
                <TableCell>
                  <Link
                    href={`/turmas/${enrollment.class.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {enrollment.class.name}
                  </Link>
                  {enrollment.status === "cancelled" ? (
                    <Alert tone="danger" className="mt-2 px-3 py-2 text-xs">
                      <p>Motivo: {formatText(enrollment.cancellation_reason)}</p>
                      {enrollment.cancellation_notes ? (
                        <p className="mt-1">
                          Observação:{" "}
                          {formatText(enrollment.cancellation_notes)}
                        </p>
                      ) : null}
                      <p className="mt-1">
                        Cancelada em: {formatDateTime(enrollment.cancelled_at)}
                      </p>
                    </Alert>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatText(enrollment.class.category)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatText(enrollment.class.teacherName)}
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
                  {formatFinancialGuardianName(enrollment.financialGuardianName)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatMoney(enrollment.monthly_amount)}
                </TableCell>
                <TableCell>
                  {enrollment.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setSelectedEnrollmentId(enrollment.id)}
                      className="border-destructive/40 text-destructive hover:bg-destructive/5"
                    >
                      Cancelar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={9}>Nenhuma matrícula encontrada.</TableEmpty>
          )}
        </TableBody>
      </Table>

      <CancelEnrollmentModal
        open={Boolean(selectedEnrollmentId)}
        enrollmentId={selectedEnrollmentId}
        onClose={() => setSelectedEnrollmentId(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
