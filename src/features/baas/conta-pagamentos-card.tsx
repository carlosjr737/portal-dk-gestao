"use client";

import { useActionState } from "react";
import {
  criarSubcontaEscola,
  type CriarSubcontaEscolaState,
} from "@/features/baas/subconta-actions";
import { AsaasSelo } from "@/components/brand/asaas-selo";

const initial: CriarSubcontaEscolaState = {};

const STATUS_LABEL: Record<string, { texto: string; classe: string }> = {
  pendente: { texto: "Não criada", classe: "bg-muted text-muted-foreground" },
  analise: { texto: "Em análise", classe: "bg-amber-100 text-amber-800" },
  aprovada: { texto: "Aprovada", classe: "bg-emerald-100 text-emerald-800" },
  recusada: { texto: "Recusada", classe: "bg-rose-100 text-rose-800" },
};

export function ContaPagamentosCard({
  kycStatus,
  accountId,
  walletId,
  ambiente,
}: {
  kycStatus: string | null;
  accountId: string | null;
  walletId: string | null;
  ambiente: string;
}) {
  const [state, formAction, pending] = useActionState(criarSubcontaEscola, initial);
  const status = STATUS_LABEL[kycStatus ?? "pendente"] ?? STATUS_LABEL.pendente;
  const jaCriada = Boolean(accountId);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Conta de pagamentos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conta usada para receber as mensalidades dos alunos. O dinheiro cai
            direto nela.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.classe}`}
        >
          {status.texto}
        </span>
      </div>

      {ambiente !== "production" ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ambiente de <strong>testes</strong>. Nenhum dinheiro real é movimentado.
        </p>
      ) : null}

      {state.message ? (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
          {state.faltando?.length ? (
            <ul className="mt-1 list-inside list-disc text-xs">
              {state.faltando.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {jaCriada ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Identificador da conta</dt>
            <dd className="font-mono text-xs text-foreground">{accountId}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Carteira (split)</dt>
            <dd className="font-mono text-xs text-foreground">{walletId ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-foreground">
              Faturamento mensal estimado
            </span>
            <input
              name="faturamento"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="0,00"
              className="mt-1 h-9 w-48 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-foreground">Tipo de empresa</span>
            <select
              name="company_type"
              required
              defaultValue=""
              className="mt-1 h-9 w-48 rounded-md border border-border bg-white px-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Selecione…</option>
              <option value="MEI">MEI</option>
              <option value="LIMITED">Ltda</option>
              <option value="INDIVIDUAL">Empresário individual</option>
              <option value="ASSOCIATION">Associação</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Criando…" : "Criar conta de pagamentos"}
          </button>
        </form>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <AsaasSelo variant="azul" />
      </div>
    </div>
  );
}
