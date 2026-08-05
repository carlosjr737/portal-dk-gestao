"use client";

import { useActionState, useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { criarAvulsa, type AvulsaState } from "@/features/baas/avulsa-actions";

export type ResponsavelOpcao = { id: string; nome: string };

const mascaraDinheiro = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  return (Number(d) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

/**
 * Cobrança avulsa — uma cobrança só, fora da mensalidade.
 *
 * O caminho principal é vir de uma cobrança estornada, e por isso o
 * formulário chega preenchido: quem estornou não deve redigitar nada.
 *
 * NENHUMA MATRÍCULA É CRIADA OU ALTERADA aqui. É uma cobrança solta — o que
 * separa isto da mensalidade, que se repete todo mês.
 */
export function AvulsaForm({
  responsaveis,
  inicial,
  taxa,
}: {
  responsaveis: ResponsavelOpcao[];
  inicial: {
    guardianId: string;
    valor: string;
    descricao: string;
    vencimento: string;
  };
  taxa: number | null;
}) {
  const [state, formAction, enviando] = useActionState<AvulsaState, FormData>(
    criarAvulsa,
    {},
  );
  const [valor, setValor] = useState(inicial.valor);
  const [forma, setForma] = useState<"BOLETO" | "PIX">("BOLETO");
  const [copiado, setCopiado] = useState<string | null>(null);

  const dinheiro = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const bruto =
    Number(
      valor
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", "."),
    ) || 0;
  const liquido = taxa !== null && bruto > 0 ? bruto - taxa : null;

  const copiar = async (texto: string, qual: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(qual);
    setTimeout(() => setCopiado(null), 2000);
  };

  // ── criada: a tela vira entrega ──────────────────────────────────────
  if (state.ok && state.cobranca) {
    const c = state.cobranca;
    const venc = c.vencimento.split("-").reverse().join("/");
    const mensagem =
      `Olá, ${c.pagador.split(" ")[0]}! Segue a cobrança de ${c.descricao}, ` +
      `no valor de ${dinheiro(c.valor)}, com vencimento em ${venc}.\n\n` +
      `${c.invoiceUrl}`;

    const telefone = (c.telefone ?? "").replace(/\D/g, "");
    const whatsapp = `https://wa.me/${telefone.length >= 10 ? `55${telefone}` : ""}?text=${encodeURIComponent(mensagem)}`;

    return (
      <div className="mt-6 space-y-4">
        <Alert tone="success">
          Cobrança de {dinheiro(c.valor)} criada para {c.pagador}, com
          vencimento em {venc}.
        </Alert>

        {/*
          O provedor não notifica ninguém — cada envio dele é cobrado. Se a
          tela não disser isso, a escola cria a cobrança e vai embora achando
          que a família foi avisada.
        */}
        <Alert tone="warning">
          <strong className="font-semibold">Ninguém foi avisado ainda.</strong>{" "}
          Você entrega o link.
        </Alert>

        <Card className="space-y-3 p-5">
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Enviar no WhatsApp
          </a>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              onClick={() => copiar(c.invoiceUrl, "link")}
            >
              {copiado === "link" ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copiado === "link" ? "Link copiado" : "Copiar link"}
            </Button>

            {c.pixCopiaECola ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                onClick={() => copiar(c.pixCopiaECola!, "pix")}
              >
                {copiado === "pix" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copiado === "pix" ? "Pix copiado" : "Copiar Pix"}
              </Button>
            ) : null}
          </div>

          <a
            href={c.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Ver a fatura
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            O pagamento aparece sozinho no extrato e na conciliação. Você não
            precisa dar baixa.
          </p>
        </Card>
      </div>
    );
  }

  // ── formulário ───────────────────────────────────────────────────────
  return (
    <form action={formAction} className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="space-y-4 p-6">
        <div>
          <label
            htmlFor="guardian_id"
            className="text-sm font-medium text-foreground"
          >
            Cobrar de <span className="text-danger-text">*</span>
          </label>
          {/* O responsável FINANCEIRO, nunca o aluno — quem paga é ele. */}
          <select
            id="guardian_id"
            name="guardian_id"
            defaultValue={inicial.guardianId}
            className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <option value="">Selecione o responsável</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <div>
            <label
              htmlFor="vencimento"
              className="text-sm font-medium text-foreground"
            >
              Vencimento <span className="text-danger-text">*</span>
            </label>
            <input
              id="vencimento"
              name="vencimento"
              type="date"
              defaultValue={inicial.vencimento}
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground tabular-nums outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="descricao"
            className="text-sm font-medium text-foreground"
          >
            Descrição <span className="text-danger-text">*</span>
          </label>
          <input
            id="descricao"
            name="descricao"
            defaultValue={inicial.descricao}
            placeholder="Ex.: Mensalidade de agosto — reemissão"
            className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Aparece para quem paga e no extrato da escola.
          </p>
        </div>

        <div>
          <span className="text-sm font-medium text-foreground">
            Forma de pagamento
          </span>
          <div className="mt-1.5 flex flex-wrap gap-2" role="group">
            {(
              [
                { v: "BOLETO", label: "Boleto e Pix" },
                { v: "PIX", label: "Só Pix" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setForma(o.v)}
                aria-pressed={forma === o.v}
                className={`h-11 rounded-md border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  forma === o.v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-foreground hover:bg-muted"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="forma" value={forma} />
          {/* Cartão não é opção — o repasse só vem depois da liquidação da
              bandeira e fura o caixa da escola. */}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sem cartão de crédito.
          </p>
        </div>

        {state.message && !state.ok ? (
          <Alert tone="danger">{state.message}</Alert>
        ) : null}

        <Button type="submit" disabled={enviando} className="h-11 w-full">
          {enviando ? "Criando…" : "Criar cobrança"}
        </Button>
      </Card>

      <Card className="h-fit space-y-3 p-6">
        <h2 className="text-sm font-semibold text-foreground">Quanto você recebe</h2>
        {liquido !== null ? (
          <>
            <p className="text-[22px] font-bold leading-7 text-foreground tabular-nums">
              {dinheiro(liquido)}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {dinheiro(bruto)} menos a taxa de {dinheiro(taxa!)}.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Informe o valor para ver o líquido.
          </p>
        )}
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Esta cobrança não cria nem altera matrícula, e não entra no
          faturamento contratado.
        </p>
      </Card>
    </form>
  );
}
