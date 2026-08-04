"use client";

import { useEffect, useState } from "react";
import type { LinhaMensalidade } from "@/features/mensalidades/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Props = {
  linha: LinhaMensalidade | null;
  onClose: () => void;
  onConfirm: (payload: {
    paymentId: string;
    valor: number;
    vencimento: string;
    billingType: string;
  }) => Promise<void>;
};

/**
 * Ajuste de UMA parcela emitida no provedor.
 *
 * O aviso sobre valer só para este mês está na tela, e não só no código, pela
 * mesma razão que o modal de troca de turma explica o que não muda: sem isso a
 * pessoa fica na dúvida se está mexendo no contrato inteiro e desiste — ou pior,
 * mexe achando que é pontual.
 */
export function EditarCobrancaModal({ linha, onClose, onConfirm }: Props) {
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!linha) return;
    setValor(String(linha.valor));
    setVencimento(linha.vencimento ?? "");
    setErro("");
    setEnviando(false);
  }, [linha]);

  if (!linha || !linha.paymentId) return null;

  async function confirmar() {
    const numero = Number(valor.replace(",", "."));
    if (!Number.isFinite(numero) || numero <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
      setErro("Informe uma data de vencimento válida.");
      return;
    }

    setEnviando(true);
    setErro("");
    try {
      await onConfirm({
        paymentId: linha!.paymentId as string,
        valor: numero,
        vencimento,
        billingType: linha!.billingType ?? "UNDEFINED",
      });
      onClose();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível alterar a cobrança.",
      );
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">
          Editar cobrança
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {linha.referencia}
        </p>

        <div className="mt-5 space-y-4">
          <Field label="Valor" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Field>

          <Field label="Vencimento" required>
            <Input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </Field>

          <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            A alteração vale{" "}
            <strong className="font-medium text-foreground">
              só para esta parcela
            </strong>
            . Os próximos meses continuam com o valor do contrato. Se o link já
            foi enviado, mande de novo — o antigo passa a mostrar o valor novo,
            mas o boleto emitido não.
          </div>

          {erro ? <Alert tone="danger">{erro}</Alert> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? "Salvando…" : "Salvar alteração"}
          </Button>
        </div>
      </div>
    </div>
  );
}
