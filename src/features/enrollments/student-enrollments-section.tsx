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
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          Não foi possível carregar as matrículas do aluno.
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Turma</th>
              <th className="px-4 py-3 font-semibold">Modalidade</th>
              <th className="px-4 py-3 font-semibold">Professor</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Início</th>
              <th className="px-4 py-3 font-semibold">Final</th>
              <th className="px-4 py-3 font-semibold">Resp. financeiro</th>
              <th className="px-4 py-3 font-semibold">Valor mensal</th>
              <th className="px-4 py-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {enrollments.length > 0 ? (
              enrollments.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/turmas/${enrollment.class.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {enrollment.class.name}
                    </Link>
                    {enrollment.status === "cancelled" ? (
                      <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
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
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatText(enrollment.class.category)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatText(enrollment.class.teacherName)}
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
                      enrollment.financialGuardianName,
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatMoney(enrollment.monthly_amount)}
                  </td>
                  <td className="px-4 py-3">
                    {enrollment.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => setSelectedEnrollmentId(enrollment.id)}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-rose-200 px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                      >
                        Cancelar
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma matrícula encontrada.
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
    </div>
  );
}
