"use client";

import { useActionState } from "react";
import {
  criarAssinaturaEscola,
  type AssinaturaState,
} from "@/features/plataforma/assinatura-actions";
import { Select } from "@/components/ui/select";

export type PlanoOption = {
  id: string;
  nome: string;
  periodicidade: string;
  valor: number;
};

const initial: AssinaturaState = {};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function AssinaturaForm({
  escolaId,
  escolaNome,
  planos,
}: {
  escolaId: string;
  escolaNome: string;
  planos: PlanoOption[];
}) {
  const [state, formAction, pending] = useActionState(criarAssinaturaEscola, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="escola_id" value={escolaId} />

      {state.message ? (
        <div
          className={`w-full rounded-md px-3 py-2 text-sm ${
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

      <label className="block">
        <span className="text-xs font-medium text-slate-700">
          Plano para {escolaNome}
        </span>
        <Select
          name="plano_id"
          required
          defaultValue=""
          className="mt-1 h-9 w-64 border-slate-300 px-2 focus:border-slate-900"
        >
          <option value="">Selecione…</option>
          {planos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} — {brl.format(p.valor)}
              {p.periodicidade === "mensal" ? "/mês" : "/ano"}
            </option>
          ))}
        </Select>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-700">Forma de cobrança</span>
        <Select
          name="billing_type"
          defaultValue="PIX"
          className="mt-1 h-9 w-40 border-slate-300 px-2 focus:border-slate-900"
        >
          <option value="PIX">Pix</option>
          <option value="BOLETO">Boleto</option>
          <option value="CREDIT_CARD">Cartão</option>
        </Select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar assinatura"}
      </button>
    </form>
  );
}
