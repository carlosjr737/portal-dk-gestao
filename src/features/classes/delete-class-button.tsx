"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOrArchiveClass } from "@/features/classes/actions";

type DeleteClassButtonProps = {
  classId: string;
  className: string;
  enrollmentsCount: number;
  redirectOnSuccess?: boolean;
};

export function DeleteClassButton({
  classId,
  className,
  enrollmentsCount,
  redirectOnSuccess,
}: DeleteClassButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleConfirm() {
    setIsSubmitting(true);
    setErrorMessage("");

    const result = await deleteOrArchiveClass(classId);

    if (!result.success) {
      setErrorMessage(result.message);
      setIsSubmitting(false);
      return;
    }

    setIsOpen(false);

    if (redirectOnSuccess) {
      router.push(`/turmas?classAction=${result.action}`);
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium text-rose-700 hover:underline"
      >
        Excluir
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground">
              Excluir turma
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {enrollmentsCount > 0
                ? "Esta turma possui matrículas vinculadas. Para preservar o histórico, ela será arquivada e não aparecerá mais nas turmas ativas."
                : "Esta turma não possui matrículas. Ela será excluída definitivamente."}
            </p>
            <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
              {className}
            </p>

            {errorMessage ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setErrorMessage("");
                }}
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
                {isSubmitting ? "Processando..." : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
