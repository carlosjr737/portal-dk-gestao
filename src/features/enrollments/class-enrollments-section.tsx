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
    <section className="mt-6 rounded-md border border-border bg-white">
      <div className="border-b border-border p-5">
        <h2 className="text-base font-semibold text-foreground">
          Alunos matriculados
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Aluno</th>
              <th className="px-4 py-3 font-semibold">Mensalidade</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Vigência</th>
              <th className="px-4 py-3 font-semibold">Resp. financeiro</th>
              <th className="px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {enrollments.length > 0 ? (
              enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/alunos/${enrollment.student.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {enrollment.student.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <EnrollmentFeeCell
                      monthlyAmount={enrollment.monthlyAmount}
                      discountAmount={enrollment.discountAmount}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatEnrollmentStatus(enrollment.status)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(enrollment.start_date)} até{" "}
                    {formatDate(enrollment.end_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatFinancialGuardianName(
                      enrollment.financialGuardianName,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedEnrollmentId(enrollment.id)}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-rose-200 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                    >
                      Cancelar matrícula
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum aluno matriculado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CancelEnrollmentModal
        open={Boolean(selectedEnrollmentId)}
        enrollmentId={selectedEnrollmentId}
        onClose={() => setSelectedEnrollmentId(null)}
        onConfirm={handleConfirm}
      />
    </section>
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
