"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Copy,
  MessageCircle,
  Pencil,
  RotateCcw,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  editarCobrancaAction,
  excluirCobrancaAction,
  type CobrancaAcaoState,
} from "@/features/baas/cobranca-acoes";

/**
 * Ações de uma cobrança, como ícones.
 *
 * Eram botões de texto empilhados — "Estornar", "Refazer cobrança" — cada um
 * ocupando uma linha inteira e empurrando a lista para baixo. Como ícone, as
 * ações cabem numa faixa só e a lista volta a ser escaneável.
 *
 * O QUE APARECE DEPENDE DO STATUS, E ISSO NÃO É ENFEITE.
 * Excluir cobrança paga e editar valor de quem já pagou são erros caros e
 * irreversíveis. Escondê-los quando não fazem sentido tira a chance de
 * acontecer — é a mesma ideia do painel do Asaas, onde o ícone some em vez de
 * recusar depois do clique.
 *
 * Toda ação destrutiva confirma antes, e a confirmação diz o efeito em vez de
 * perguntar "tem certeza?" — quem lê "tem certeza" clica em sim no automático.
 *
 * ÍCONE SOZINHO NÃO BASTA. Cada botão leva `title` e `aria-label`: o desenho
 * acelera para quem já conhece, o texto é o que salva quem não conhece — e é
 * o único caminho para leitor de tela.
 */

type Props = {
  paymentId: string;
  status: string;
  valor: number;
  vencimento: string;
  linkFatura: string | null;
  /** Já pedida a devolução; some o estorno e aparece o refazer. */
  estornada: boolean;
  /** Slot para o botão de estorno, que já existe e tem confirmação própria. */
  estorno?: React.ReactNode;
};

const EM_ABERTO = ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"];

export function CobrancaAcoesBarra({
  paymentId,
  status,
  valor,
  vencimento,
  linkFatura,
  estornada,
  estorno,
}: Props) {
  const [aberto, setAberto] = useState<"editar" | "excluir" | null>(null);
  const [copiado, setCopiado] = useState(false);

  const emAberto = EM_ABERTO.includes(status) && !estornada;
  const foiEstornada = status === "REFUNDED" || estornada;

  return (
    <div className="-mt-2 flex flex-col items-end gap-2">
      <div className="flex items-center gap-1">
        {/*
          Enviar a cobrança = mandar o link da fatura. O provedor não notifica
          ninguém (`notificationDisabled`), então quem entrega é a escola, e
          este link É o canal. WhatsApp porque é por onde a secretaria fala
          com as famílias.
        */}
        {emAberto && linkFatura ? (
          <>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Segue o link para pagamento da mensalidade: ${linkFatura}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Enviar cobrança por WhatsApp"
              aria-label="Enviar cobrança por WhatsApp"
              className={ICONE}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(linkFatura);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              title={copiado ? "Link copiado" : "Copiar link de pagamento"}
              aria-label="Copiar link de pagamento"
              className={ICONE}
            >
              <Copy className="h-4 w-4" aria-hidden />
            </button>
          </>
        ) : null}

        {emAberto ? (
          <button
            type="button"
            onClick={() => setAberto(aberto === "editar" ? null : "editar")}
            title="Editar valor ou vencimento"
            aria-label="Editar valor ou vencimento"
            aria-expanded={aberto === "editar"}
            className={ICONE}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
        ) : null}

        {/* O estorno já vem pronto de fora, com a confirmação dele. */}
        {estorno}

        {foiEstornada ? (
          <Link
            href={`/financeiro/conta/avulsa?refazer=${encodeURIComponent(paymentId)}`}
            title="Refazer cobrança"
            aria-label="Refazer cobrança"
            className={ICONE}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}

        {/*
          Excluir SÓ em cobrança aberta. Paga não se apaga — o dinheiro entrou
          e o extrato ficaria com uma entrada sem origem. Para desfazer
          recebimento existe o estorno, que devolve o dinheiro.
        */}
        {emAberto ? (
          <button
            type="button"
            onClick={() => setAberto(aberto === "excluir" ? null : "excluir")}
            title="Excluir cobrança"
            aria-label="Excluir cobrança"
            aria-expanded={aberto === "excluir"}
            className={`${ICONE} hover:bg-danger-tint hover:text-danger-text`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {aberto === "editar" ? (
        <FormEditar
          paymentId={paymentId}
          valor={valor}
          vencimento={vencimento}
          aoFechar={() => setAberto(null)}
        />
      ) : null}

      {aberto === "excluir" ? (
        <ConfirmarExclusao
          paymentId={paymentId}
          aoFechar={() => setAberto(null)}
        />
      ) : null}
    </div>
  );
}

const ICONE =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-input text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function FormEditar({
  paymentId,
  valor,
  vencimento,
  aoFechar,
}: {
  paymentId: string;
  valor: number;
  vencimento: string;
  aoFechar: () => void;
}) {
  const [state, action, enviando] = useActionState<CobrancaAcaoState, FormData>(
    editarCobrancaAction,
    {},
  );

  if (state.ok) {
    return (
      <Alert tone="success" className="w-full max-w-md">
        {state.message}
      </Alert>
    );
  }

  return (
    <form
      action={action}
      className="w-full max-w-md rounded-lg border border-border bg-muted/40 p-4"
    >
      <input type="hidden" name="payment_id" value={paymentId} />
      <p className="text-sm font-medium text-foreground">Editar cobrança</p>
      {/*
        Muda o que a família vai ver, e é bom dizer isso antes: o link já pode
        estar no WhatsApp dela, e o valor muda embaixo do nariz de quem
        recebeu.
      */}
      <p className="mt-0.5 text-xs text-muted-foreground">
        O link que a família já recebeu passa a mostrar o valor novo.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-foreground">
          Valor
          <input
            name="valor"
            inputMode="numeric"
            defaultValue={valor.toFixed(2).replace(".", ",")}
            className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
        <label className="text-xs font-medium text-foreground">
          Vencimento
          <input
            name="vencimento"
            type="date"
            defaultValue={vencimento}
            className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </label>
      </div>

      {state.message && !state.ok ? (
        <Alert tone="danger" className="mt-3">
          {state.message}
        </Alert>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={aoFechar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function ConfirmarExclusao({
  paymentId,
  aoFechar,
}: {
  paymentId: string;
  aoFechar: () => void;
}) {
  const [state, action, enviando] = useActionState<CobrancaAcaoState, FormData>(
    excluirCobrancaAction,
    {},
  );

  if (state.ok) {
    return (
      <Alert tone="success" className="w-full max-w-md">
        {state.message}
      </Alert>
    );
  }

  return (
    <form
      action={action}
      className="w-full max-w-md rounded-lg border border-danger bg-danger-tint p-4"
    >
      <input type="hidden" name="payment_id" value={paymentId} />
      {/*
        A confirmação diz O EFEITO, não "tem certeza?". Quem lê "tem certeza"
        clica em sim no automático; quem lê "o link para de funcionar" pensa
        se já mandou o link.
      */}
      <p className="text-sm font-medium text-danger-text">Excluir esta cobrança?</p>
      <p className="mt-1 text-xs text-danger-text">
        Ela some do Asaas e não volta. Se a família já recebeu o link, ele para
        de funcionar — e ninguém é avisado.
      </p>

      {state.message && !state.ok ? (
        <Alert tone="danger" className="mt-3">
          {state.message}
        </Alert>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={aoFechar} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={enviando}
          className="bg-danger text-white hover:bg-danger/90"
        >
          {enviando ? "Excluindo…" : "Excluir"}
        </Button>
      </div>
    </form>
  );
}

/** Ícone do estorno, para a barra ficar visualmente uniforme. */
export function IconeEstorno(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      title="Estornar (devolver o dinheiro)"
      aria-label="Estornar (devolver o dinheiro)"
      className={ICONE}
      {...props}
    >
      <RotateCcw className="h-4 w-4" aria-hidden />
    </button>
  );
}
