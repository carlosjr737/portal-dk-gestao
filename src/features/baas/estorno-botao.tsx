"use client";

import { useActionState, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estornar, type EstornoState } from "@/features/baas/estorno-actions";

/**
 * Estorno com confirmação no lugar.
 *
 * Estornar é irreversível e custa a taxa — que o provedor não devolve. Um
 * clique só seria pedir para alguém desfazer uma venda sem querer, então o
 * botão abre a confirmação ali mesmo, com o valor que a escola perde escrito
 * por extenso.
 *
 * A confirmação fica inline e não em modal: é uma linha de lista, e um modal
 * tiraria de vista qual cobrança está sendo estornada.
 */
export function EstornoBotao({
  paymentId,
  valor,
  taxa,
  pagador,
}: {
  paymentId: string;
  valor: number;
  /** Diferença entre bruto e líquido — o que NÃO volta no estorno. */
  taxa: number;
  pagador: string;
}) {
  const [state, formAction, enviando] = useActionState<EstornoState, FormData>(
    estornar,
    {},
  );
  const [confirmando, setConfirmando] = useState(false);

  const dinheiro = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (state.message) {
    return (
      <p
        className={`text-xs ${state.ok ? "text-success-text" : "text-danger-text"}`}
      >
        {state.message}
      </p>
    );
  }

  if (!confirmando) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirmando(true)}
      >
        Estornar
      </Button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 sm:w-auto">
      <input type="hidden" name="payment_id" value={paymentId} />
      <p className="flex items-start gap-1.5 text-xs text-warning-text">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Devolver {dinheiro(valor)} para {pagador}?
          {taxa > 0 ? (
            <>
              {" "}
              A taxa de{" "}
              <strong className="font-semibold">{dinheiro(taxa)}</strong> não
              volta.
            </>
          ) : null}{" "}
          Não dá para desfazer.
        </span>
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando ? "Estornando…" : "Confirmar estorno"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirmando(false)}
          disabled={enviando}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
