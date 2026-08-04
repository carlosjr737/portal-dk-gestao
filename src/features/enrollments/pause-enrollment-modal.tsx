"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  enrollmentId: string | null;
  alunoNome: string;
  turmaNome: string;
  onClose: () => void;
  onConfirm: (payload: {
    enrollmentId: string;
    reason?: string;
    returnDate?: string;
  }) => Promise<void>;
};

/**
 * Trancamento, com a confirmação dizendo o que muda.
 *
 * A pergunta de quem clica em "Trancar" é sempre a mesma: "vou perder a
 * matrícula dele?". A caixa cinza responde antes, pelo mesmo motivo que a
 * troca de turma responde — sem isso a pessoa cancela e recria por
 * insegurança, e aí a saída entra no churn de verdade.
 *
 * A diferença para o cancelamento também é dita em voz alta: aqui não há lista
 * de motivos de saída, porque não é saída.
 */
export function PauseEnrollmentModal({
  open,
  enrollmentId,
  alunoNome,
  turmaNome,
  onClose,
  onConfirm,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [retorno, setRetorno] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  if (!open || !enrollmentId) return null;

  function fechar() {
    setMotivo("");
    setRetorno("");
    setErro("");
    setEnviando(false);
    onClose();
  }

  async function confirmar() {
    setEnviando(true);
    setErro("");
    try {
      await onConfirm({
        enrollmentId: enrollmentId as string,
        reason: motivo.trim() || undefined,
        returnDate: retorno || undefined,
      });
      fechar();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível trancar a matrícula.",
      );
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">
          Trancar matrícula
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {alunoNome} · <strong className="font-medium">{turmaNome}</strong>
        </p>

        <div className="mt-5 space-y-4">
          <Field
            label="Motivo"
            hint="Aparece no histórico da matrícula. Ajuda quem for olhar depois."
          >
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: viagem de intercâmbio"
            />
          </Field>

          <Field
            label="Previsão de retorno"
            hint="Opcional. Fica registrada no histórico."
          >
            <Input
              type="date"
              value={retorno}
              onChange={(e) => setRetorno(e.target.value)}
            />
          </Field>

          <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            A matrícula continua existindo e{" "}
            <strong className="font-medium text-foreground">
              pode ser reativada
            </strong>{" "}
            depois, na mesma turma. Enquanto estiver trancada, ela sai da
            chamada, do faturamento e da cobrança — a família não é cobrada pelo
            período. Não conta como saída no churn.
          </div>

          {erro ? <Alert tone="danger">{erro}</Alert> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={fechar} disabled={enviando}>
            Voltar
          </Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? "Trancando…" : "Trancar matrícula"}
          </Button>
        </div>
      </div>
    </div>
  );
}
