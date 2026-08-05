"use client";

import { useActionState, useState } from "react";
import { ArrowUpRight, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  cancelarSaqueAction,
  saqueAction,
  type SaqueState,
} from "@/features/baas/saque-actions";

const TIPOS = [
  { valor: "CNPJ", label: "CNPJ" },
  { valor: "CPF", label: "CPF" },
  { valor: "EMAIL", label: "E-mail" },
  { valor: "PHONE", label: "Celular" },
  { valor: "EVP", label: "Aleatória" },
] as const;

const mascaraDinheiro = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  return (Number(d) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

/**
 * Saque para uma chave Pix, em duas etapas.
 *
 * A primeira etapa não move dinheiro: ela pergunta ao provedor de quem é a
 * chave e mostra o nome do titular. Pix cai na hora e não volta — um dígito
 * trocado manda o dinheiro para um desconhecido, e ler "Vai para: FULANO"
 * antes de confirmar é o que transforma isso em erro percebido.
 */
export function SaqueForm({ saldo }: { saldo: number }) {
  const [state, formAction, enviando] = useActionState<SaqueState, FormData>(
    saqueAction,
    {},
  );
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<string>("CNPJ");
  const [chave, setChave] = useState("");

  const dinheiro = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const bruto =
    Number(
      valor
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", "."),
    ) || 0;
  const passaDoSaldo = bruto > saldo;

  if (state.criado) {
    return (
      <Alert
        tone={state.message?.includes("aguardando") ? "warning" : "success"}
      >
        {state.message}
      </Alert>
    );
  }

  // ── etapa 2: confere o destino antes de mandar ──────────────────────
  if (state.destino) {
    const d = state.destino;
    return (
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="valor" value={valor} />
        <input type="hidden" name="tipo" value={d.tipo} />
        <input type="hidden" name="chave" value={d.chave} />
        <input type="hidden" name="confirmar" value="1" />

        <div className="rounded-md border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Confira para quem vai
          </p>
          <p className="mt-1.5 text-sm font-semibold text-foreground">
            {d.nome}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {d.cpfCnpj}
            {d.banco ? ` · ${d.banco}` : ""}
          </p>
          <p className="mt-2 text-sm text-foreground tabular-nums">
            Valor:{" "}
            <strong className="font-semibold">{dinheiro(d.valor)}</strong>
          </p>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-warning-text">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Pix cai na hora e não tem como desfazer. Se o nome acima não for da
          escola, cancele.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11" disabled={enviando}>
            {enviando ? "Enviando…" : "Confirmar saque"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={enviando}
            onClick={() => window.location.reload()}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  // ── etapa 1: quanto e para qual chave ───────────────────────────────
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="saque-valor"
          className="text-sm font-medium text-foreground"
        >
          Quanto sacar
        </label>
        <input
          id="saque-valor"
          name="valor"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(mascaraDinheiro(e.target.value))}
          placeholder="R$ 0,00"
          className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm font-semibold text-foreground tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
          Disponível: {dinheiro(saldo)}
        </p>
        {passaDoSaldo ? (
          <p className="mt-1 text-xs text-danger-text">
            Passa do saldo disponível.
          </p>
        ) : null}
      </div>

      <div>
        <span className="text-sm font-medium text-foreground">
          Tipo da chave
        </span>
        <div className="mt-1.5 flex flex-wrap gap-2" role="group">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTipo(t.valor)}
              aria-pressed={tipo === t.valor}
              className={`h-11 rounded-md border px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                tipo === t.valor
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input text-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="tipo" value={tipo} />
      </div>

      <div>
        <label
          htmlFor="saque-chave"
          className="text-sm font-medium text-foreground"
        >
          Chave Pix da escola
        </label>
        <input
          id="saque-chave"
          name="chave"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          placeholder="Chave que recebe o dinheiro"
          className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Mostramos o nome do titular antes de enviar.
        </p>
      </div>

      {state.message && !state.ok ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Button
        type="submit"
        className="h-11 w-full gap-2"
        disabled={enviando || passaDoSaldo || bruto <= 0 || !chave.trim()}
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
        {enviando ? "Conferindo…" : "Continuar"}
      </Button>
    </form>
  );
}

/**
 * Saque que já foi pedido e ainda não concluiu.
 *
 * Precisa dizer três coisas, nesta ordem: o dinheiro saiu do saldo, ainda não
 * chegou, e dá para cancelar. Omitir qualquer uma gera ligação para a
 * secretaria — a escola vê o saldo menor e nada explicando por quê.
 *
 * Sem estimativa de prazo: não temos. Escrever "em até 1 dia útil" seria
 * inventar.
 */
export function SaquePendente({
  id,
  valor,
  autorizado,
  podeCancelar,
}: {
  id: string;
  valor: number;
  autorizado: boolean;
  podeCancelar: boolean;
}) {
  const [state, formAction, enviando] = useActionState<SaqueState, FormData>(
    cancelarSaqueAction,
    {},
  );

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

  return (
    <div className="rounded-md border border-warning bg-warning-tint px-4 py-3">
      <p className="text-sm font-medium text-foreground tabular-nums">
        Saque de {dinheiro(valor)} em andamento
      </p>
      <p className="mt-1 text-xs text-foreground/80">
        O valor já saiu do saldo e ainda não chegou na conta.
        {autorizado
          ? " O provedor está processando."
          : " O provedor ainda não liberou a operação."}
      </p>
      {podeCancelar ? (
        <form action={formAction} className="mt-2">
          <input type="hidden" name="saque_id" value={id} />
          <Button type="submit" variant="outline" size="sm" disabled={enviando}>
            {enviando ? "Cancelando…" : "Cancelar e devolver ao saldo"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
