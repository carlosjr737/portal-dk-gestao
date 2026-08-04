"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { Check, Copy } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { gerarQrAvulso, type QrAvulsoState } from "@/features/baas/qr-avulso-actions";

const mascaraDinheiro = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  return (Number(d) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

/**
 * Cobrança avulsa por QR Code.
 *
 * Duas colunas: à esquerda quem preenche, à direita o QR. O cenário real é um
 * celular apontado para a tela do computador no balcão da secretaria — por
 * isso o QR ocupa a coluna inteira e o valor aparece grande embaixo dele.
 *
 * O botão de copiar existe para o outro cenário, que é mandar por WhatsApp: o
 * provedor não notifica ninguém (cada envio dele é cobrado), então a entrega é
 * sempre da escola.
 */
export function QrAvulsoForm({ taxaPix }: { taxaPix: number | null }) {
  const [state, formAction, gerando] = useActionState<QrAvulsoState, FormData>(
    gerarQrAvulso,
    {},
  );
  const [valor, setValor] = useState("");
  const [copiado, setCopiado] = useState(false);

  const bruto = Number(valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  const liquido = taxaPix !== null && bruto > 0 ? bruto - taxaPix : null;

  const dinheiro = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const copiar = async () => {
    if (!state.payload) return;
    await navigator.clipboard.writeText(state.payload);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Card className="p-6">
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="valor" className="text-sm font-medium text-foreground">
              Valor <span className="text-danger-text">*</span>
            </label>
            <input
              id="valor"
              name="valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(mascaraDinheiro(e.target.value))}
              placeholder="R$ 0,00"
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-semibold text-foreground tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            {/*
              O líquido aparece ANTES de gerar. A escola precisa saber quanto
              vai sobrar enquanto ainda dá para mudar o valor.
            */}
            {liquido !== null ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Você recebe{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {dinheiro(liquido)}
                </strong>{" "}
                — {dinheiro(bruto)} menos a taxa de {dinheiro(taxaPix!)}.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="descricao" className="text-sm font-medium text-foreground">
              Descrição <span className="text-danger-text">*</span>
            </label>
            <input
              id="descricao"
              name="descricao"
              defaultValue={state.descricao ?? ""}
              placeholder="Ex.: Figurino do espetáculo — Ana Beatriz"
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Aparece para quem paga e no extrato da escola.
            </p>
          </div>

          {state.message && !state.ok ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <Button type="submit" disabled={gerando} className="h-11 w-full">
            {gerando ? "Gerando…" : "Gerar QR Code"}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col items-center justify-center gap-4 p-6">
        {state.ok && state.payload ? (
          <>
            {state.imagemBase64 ? (
              <Image
                src={`data:image/png;base64,${state.imagemBase64}`}
                alt={`QR Code Pix de ${dinheiro(state.valor ?? 0)}`}
                width={260}
                height={260}
                unoptimized
                className="h-[260px] w-[260px] rounded-lg border border-border bg-white p-2"
              />
            ) : null}

            <div className="text-center">
              <p className="text-[22px] font-bold leading-7 text-foreground tabular-nums">
                {dinheiro(state.valor ?? 0)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{state.descricao}</p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={copiar}
              className="h-11 w-full gap-2"
            >
              {copiado ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Código copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden />
                  Copiar código Pix
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              O QR não expira e pode ser pago mais de uma vez. Gere um novo para
              cada cobrança que precisar controlar separadamente.
            </p>
          </>
        ) : (
          <p className="max-w-[34ch] text-center text-sm text-muted-foreground">
            Preencha o valor e a descrição. O QR aparece aqui, grande o
            suficiente para ser lido da tela.
          </p>
        )}
      </Card>
    </div>
  );
}
