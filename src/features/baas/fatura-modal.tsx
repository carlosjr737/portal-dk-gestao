"use client";

import { useState, useTransition } from "react";
import { obterFatura, type FaturaState } from "@/features/baas/fatura-actions";

/**
 * Entrega da cobrança ao responsável, feita pela escola.
 *
 * As notificações do provedor são cobradas por envio, então elas ficam
 * desligadas e a secretaria manda o link — normalmente por WhatsApp, que é
 * onde a família de fato lê.
 */
export function FaturaBotao({ contratoId }: { contratoId: string }) {
  const [fatura, setFatura] = useState<FaturaState | null>(null);
  const [buscando, start] = useTransition();
  const [copiado, setCopiado] = useState<string | null>(null);

  function buscar() {
    start(async () => setFatura(await obterFatura(contratoId)));
  }

  function copiar(texto: string, marca: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(marca);
    setTimeout(() => setCopiado(null), 2000);
  }

  if (!fatura) {
    return (
      <button
        type="button"
        onClick={buscar}
        disabled={buscando}
        className="text-xs font-medium text-primary underline underline-offset-2 disabled:opacity-60"
      >
        {buscando ? "Buscando…" : "Enviar cobrança"}
      </button>
    );
  }

  if (!fatura.ok) {
    return (
      <div className="text-xs">
        <p className="text-rose-600">{fatura.message}</p>
        <button
          type="button"
          onClick={() => setFatura(null)}
          className="mt-1 text-muted-foreground underline"
        >
          Fechar
        </button>
      </div>
    );
  }

  const telefone = (fatura.telefone ?? "").replace(/\D/g, "");
  const zap = telefone
    ? `https://wa.me/55${telefone}?text=${encodeURIComponent(fatura.textoWhatsapp ?? "")}`
    : null;

  return (
    <div className="min-w-[240px] rounded-md border border-border bg-muted/30 p-2 text-xs">
      <div className="flex gap-1.5">
        {zap ? (
          <a
            href={zap}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-2 font-medium text-white transition hover:bg-emerald-700"
          >
            WhatsApp
          </a>
        ) : (
          <span className="inline-flex h-7 items-center px-1 text-muted-foreground">
            sem telefone
          </span>
        )}
        <button
          type="button"
          onClick={() => copiar(fatura.invoiceUrl ?? "", "link")}
          className="inline-flex h-7 items-center rounded-md border border-border bg-white px-2 font-medium text-foreground hover:bg-muted"
        >
          {copiado === "link" ? "Copiado" : "Copiar link"}
        </button>
      </div>

      {fatura.pixCopiaECola ? (
        <button
          type="button"
          onClick={() => copiar(fatura.pixCopiaECola ?? "", "pix")}
          className="mt-1.5 w-full rounded-md border border-border bg-white px-2 py-1 font-medium text-foreground hover:bg-muted"
        >
          {copiado === "pix" ? "Pix copiado" : "Copiar Pix copia-e-cola"}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setFatura(null)}
        className="mt-1.5 text-muted-foreground underline"
      >
        Fechar
      </button>
    </div>
  );
}
