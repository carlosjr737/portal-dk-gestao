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
    enrollmentId: string;
    competencia: string;
    recebidoEm: string;
    valor: number;
  }) => Promise<void>;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Baixa manual: dinheiro, Pix direto na conta da escola, acordo.
 *
 * MARCAR, NÃO CADASTRAR. O valor já vem preenchido com o da matrícula e a data
 * com hoje — o caminho normal é confirmar. Os dois campos são editáveis porque
 * o caso real de "pagou R$ 50 a menos" e "pagou semana passada" existe, mas
 * ninguém deveria ter que digitar nada para dar baixa no caso comum. Um
 * formulário em branco aqui é o motivo de o dado nunca ser preenchido.
 */
export function BaixaManualModal({ linha, onClose, onConfirm }: Props) {
  const [recebidoEm, setRecebidoEm] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const editando = Boolean(linha?.recebimento);

  useEffect(() => {
    if (!linha) return;
    setRecebidoEm(linha.recebimento ?? hojeISO());
    setValor(String(linha.valorRecebido ?? linha.valor));
    setErro("");
    setEnviando(false);
  }, [linha]);

  if (!linha || !linha.enrollmentId) return null;

  async function confirmar() {
    const numero = Number(valor.replace(",", "."));
    if (!Number.isFinite(numero) || numero < 0) {
      setErro("Informe um valor válido.");
      return;
    }

    setEnviando(true);
    setErro("");
    try {
      await onConfirm({
        enrollmentId: linha!.enrollmentId as string,
        competencia: linha!.competencia,
        recebidoEm,
        valor: numero,
      });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível dar baixa.");
      setEnviando(false);
    }
  }

  const mes = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(linha.competencia));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">
          {editando ? "Editar baixa" : "Dar baixa manual"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {linha.referencia} · {mes} · combinado {brl.format(linha.valor)}
        </p>

        <div className="mt-5 space-y-4">
          <Field label="Recebido em" required>
            <Input
              type="date"
              value={recebidoEm}
              onChange={(e) => setRecebidoEm(e.target.value)}
            />
          </Field>

          <Field
            label="Valor recebido"
            hint="Vale só para este mês. O combinado da matrícula não muda."
            required
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Field>

          {erro ? <Alert tone="danger">{erro}</Alert> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? "Salvando…" : editando ? "Salvar" : "Dar baixa"}
          </Button>
        </div>
      </div>
    </div>
  );
}
