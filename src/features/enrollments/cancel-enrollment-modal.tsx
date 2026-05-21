"use client";

import { useState } from "react";
import { enrollmentCancellationReasons } from "@/features/enrollments/schemas";

type CancelEnrollmentModalProps = {
  open: boolean;
  enrollmentId: string | null;
  onClose: () => void;
  onConfirm: (payload: {
    enrollmentId: string;
    cancellationReason: string;
    cancellationNotes?: string;
  }) => Promise<void> | void;
};

export function CancelEnrollmentModal({
  open,
  enrollmentId,
  onClose,
  onConfirm,
}: CancelEnrollmentModalProps) {
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationNotes, setCancellationNotes] = useState("");
  const [hasTriedConfirm, setHasTriedConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!open || enrollmentId === null) {
    return null;
  }

  const activeEnrollmentId = enrollmentId;

  function resetModal() {
    setCancellationReason("");
    setCancellationNotes("");
    setHasTriedConfirm(false);
    setIsSubmitting(false);
    setErrorMessage("");
  }

  function handleClose() {
    resetModal();
    onClose();
  }

  async function handleConfirm() {
    setHasTriedConfirm(true);
    setErrorMessage("");

    if (!cancellationReason) {
      setErrorMessage("Selecione um motivo.");
      return;
    }

    if (
      cancellationReason === "Outro" &&
      cancellationNotes.trim().length === 0
    ) {
      setErrorMessage("Descreva o motivo em observação complementar.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm({
        enrollmentId: activeEnrollmentId,
        cancellationReason,
        cancellationNotes: cancellationNotes.trim() || undefined,
      });
      resetModal();
      onClose();
    } catch (error) {
      console.error("Cancel enrollment error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível cancelar a matrícula.",
      );
      setIsSubmitting(false);
    }
  }

  const showReasonError = hasTriedConfirm && !cancellationReason;
  const showNotesError =
    hasTriedConfirm &&
    cancellationReason === "Outro" &&
    cancellationNotes.trim().length === 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-2xl">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Cancelar matrícula
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Selecione o motivo do cancelamento. Essa informação será usada nos
            relatórios de gestão.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Motivo do cancelamento
            </span>
            <select
              value={cancellationReason}
              onChange={(event) => {
                setCancellationReason(event.target.value);
                setErrorMessage("");
              }}
              className="mt-1 h-11 w-full rounded-md border px-3 text-sm text-foreground outline-none transition focus:border-primary"
            >
              <option value="">Selecione um motivo</option>
              {enrollmentCancellationReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            {showReasonError ? (
              <span className="mt-1 block text-xs text-red-600">
                Selecione um motivo.
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Observação complementar
            </span>
            <textarea
              value={cancellationNotes}
              onChange={(event) => {
                setCancellationNotes(event.target.value);
                setErrorMessage("");
              }}
              placeholder={
                cancellationReason === "Outro"
                  ? "Descreva o motivo do cancelamento"
                  : "Opcional"
              }
              className="mt-1 min-h-28 w-full resize-none rounded-md border px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
            />
            {showNotesError ? (
              <span className="mt-1 block text-xs text-red-600">
                Descreva o motivo em observação complementar.
              </span>
            ) : null}
          </label>

          {errorMessage ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="inline-flex h-10 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Cancelando..." : "Confirmar cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
