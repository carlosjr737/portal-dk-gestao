"use client";

import { useActionState } from "react";
import {
  criarCobrancaAluno,
  type CobrancaAlunoState,
} from "@/features/baas/cobranca-aluno-actions";
import { FaturaBotao } from "@/features/baas/fatura-modal";

const initial: CobrancaAlunoState = {};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function CobrancaAlunoButton({
  contratoId,
  valor,
  jaTemCobranca,
  statusCobranca,
  proximoVencimento,
}: {
  contratoId: string;
  valor: number | null;
  jaTemCobranca: boolean;
  statusCobranca?: string | null;
  proximoVencimento?: string | null;
}) {
  const [state, formAction, pending] = useActionState(criarCobrancaAluno, initial);

  if (jaTemCobranca) {
    const rotulo: Record<string, { texto: string; classe: string }> = {
      pendente: { texto: "Aguardando pagamento", classe: "bg-amber-100 text-amber-800" },
      ativa: { texto: "Em dia", classe: "bg-emerald-100 text-emerald-800" },
      atrasada: { texto: "Em atraso", classe: "bg-rose-100 text-rose-800" },
      cancelada: { texto: "Cancelada", classe: "bg-muted text-muted-foreground" },
    };
    const r = rotulo[statusCobranca ?? "pendente"] ?? rotulo.pendente;
    const emAberto = statusCobranca !== "cancelada";
    return (
      <div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.classe}`}>
          {r.texto}
        </span>
        {proximoVencimento ? (
          <p className="mt-1 text-xs text-muted-foreground">
            vence {proximoVencimento.split("-").reverse().join("/")}
          </p>
        ) : null}
        {emAberto ? (
          <div className="mt-1">
            <FaturaBotao contratoId={contratoId} />
          </div>
        ) : null}
      </div>
    );
  }

  // Sem cobrança: normalmente a matrícula é que a cria, automaticamente.
  // Chegar aqui significa que algo impediu (responsável sem CPF, matrícula
  // anterior ao módulo financeiro). O botão é o conserto, não o caminho.
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="contrato_id" value={contratoId} />
      <input type="hidden" name="billing_type" value="UNDEFINED" />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-7 items-center justify-center rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-60"
        title="A cobrança normalmente é criada junto com a matrícula"
      >
        {pending
          ? "Criando…"
          : `Gerar cobrança${valor ? ` ${brl.format(valor)}` : ""}`}
      </button>
      {state.message ? (
        <p
          className={`text-xs ${state.ok ? "text-emerald-700" : "text-rose-600"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
