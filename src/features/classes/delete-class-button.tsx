"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteOrArchiveClass } from "@/features/classes/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

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
      {/*
        Era um texto sublinhado dentro de um <span> que imitava a moldura de
        um botão. Agora é botão de verdade, na mesma altura de "Voltar" e
        "Editar" — mas em contorno, e não sólido: excluir turma não é a ação
        que a pessoa veio fazer nesta tela.
      */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="border-destructive/40 text-destructive hover:bg-destructive/5"
      >
        Excluir
      </Button>

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
              <Alert tone="danger" className="mt-4 px-3 py-2">
                {errorMessage}
              </Alert>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setErrorMessage("");
                }}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processando..." : "Confirmar exclusão"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
