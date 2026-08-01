"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelEnrollment } from "@/features/enrollments/actions";
import { CancelEnrollmentModal } from "@/features/enrollments/cancel-enrollment-modal";
import {
  formatEnrollmentStatus,
  formatFinancialGuardianName,
} from "@/features/enrollments/formatters";
import type { EnrollmentStatus } from "@/features/enrollments/schemas";
import { formatDate } from "@/features/students/formatters";
import { Card } from "@/components/ui/card";
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

export type ClassEnrollmentItem = {
  id: string;
  status: EnrollmentStatus;
  start_date: string | null;
  end_date: string | null;
  financialGuardianName: string | null;
  monthlyAmount: number | null;
  discountAmount: number | null;
  student: {
    id: string;
    full_name: string;
  };
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrencyBRL(value: number) {
  return currencyFormatter.format(value);
}

type ClassEnrollmentsSectionProps = {
  enrollments: ClassEnrollmentItem[];
};

export function ClassEnrollmentsSection({
  enrollments,
}: ClassEnrollmentsSectionProps) {
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
    <Card className="mt-6">
      <div className="border-b border-border p-5">
        <h2 className="text-base font-semibold text-foreground">
          Alunos matriculados
        </h2>
      </div>
      <Table containerClassName="rounded-none border-0" minWidth="760px">
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Mensalidade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Vigência</TableHead>
            <TableHead>Resp. financeiro</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enrollments.length > 0 ? (
            enrollments.map((enrollment) => (
              <TableRow key={enrollment.id}>
                <TableCell>
                  <Link
                    href={`/alunos/${enrollment.student.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {enrollment.student.full_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <EnrollmentFeeCell
                    monthlyAmount={enrollment.monthlyAmount}
                    discountAmount={enrollment.discountAmount}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatEnrollmentStatus(enrollment.status)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(enrollment.start_date)} até{" "}
                  {formatDate(enrollment.end_date)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFinancialGuardianName(enrollment.financialGuardianName)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setSelectedEnrollmentId(enrollment.id)}
                    className="border-destructive/40 text-destructive hover:bg-destructive/5"
                  >
                    Cancelar matrícula
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={6}>Nenhum aluno matriculado.</TableEmpty>
          )}
        </TableBody>
      </Table>

      <CancelEnrollmentModal
        open={Boolean(selectedEnrollmentId)}
        enrollmentId={selectedEnrollmentId}
        onClose={() => setSelectedEnrollmentId(null)}
        onConfirm={handleConfirm}
      />
    </Card>
  );
}

function EnrollmentFeeCell({
  monthlyAmount,
  discountAmount,
}: {
  monthlyAmount: number | null;
  discountAmount: number | null;
}) {
  if (monthlyAmount === null || Number(monthlyAmount) === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
        Sem valor cadastrado
      </span>
    );
  }

  const gross = Number(monthlyAmount);
  const discount = Math.max(0, Number(discountAmount ?? 0));
  const net = Math.max(0, gross - discount);
  const hasDiscount = discount > 0;

  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold text-foreground">
        {formatCurrencyBRL(net)}
      </span>
      {hasDiscount ? (
        <span className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground line-through">
            {formatCurrencyBRL(gross)}
          </span>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            Desconto −{formatCurrencyBRL(discount)}
          </span>
        </span>
      ) : (
        <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
          Integral
        </span>
      )}
    </div>
  );
}
