"use client";

import { useActionState, useState } from "react";
import { criarEscola, type NovaEscolaState } from "@/features/plataforma/escola-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initial: NovaEscolaState = {};

export function NovaEscolaForm() {
  const [state, formAction, pending] = useActionState(criarEscola, initial);
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  if (!aberto && !state.ok) {
    return (
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={() => setAberto(true)}
      >
        + Cadastrar escola
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Cadastrar escola</h2>
      <p className="mt-1 text-sm text-slate-500">
        A escola e o primeiro usuário dela são criados juntos — sem um usuário
        vinculado, ninguém consegue entrar.
      </p>

      {state.message ? (
        <div
          className={`mt-4 rounded-md px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {state.ok && state.linkAcesso ? (
        <div className="mt-3">
          <label className="text-xs font-medium text-slate-700">
            Link de acesso (expira em algumas horas)
          </label>
          <div className="mt-1 flex gap-2">
            <Input
              readOnly
              value={state.linkAcesso}
              onFocus={(e) => e.currentTarget.select()}
              className="border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(state.linkAcesso ?? "");
                setCopiado(true);
              }}
              className="shrink-0 text-xs"
            >
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Envie para {state.emailAdmin}. O sistema não dispara e-mail.
          </p>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Concluir
          </Button>
        </div>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo
              label="Nome da escola"
              name="nome"
              required
              erro={state.errors?.nome?.[0]}
            />
            <Campo label="Razão social" name="razao_social" />
            <Campo label="CNPJ" name="cnpj" placeholder="Somente números" />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Responsável (primeiro acesso)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo
                label="Nome"
                name="admin_nome"
                required
                erro={state.errors?.admin_nome?.[0]}
              />
              <Campo
                label="E-mail"
                name="admin_email"
                type="email"
                required
                erro={state.errors?.admin_email?.[0]}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="submit"
              disabled={pending}
            >
              {pending ? "Cadastrando…" : "Cadastrar escola"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAberto(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Campo({
  label,
  name,
  type = "text",
  placeholder,
  required,
  erro,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  erro?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <Input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="mt-1 h-9 border-slate-300 focus:border-slate-900"
      />
      {erro ? <span className="mt-0.5 block text-xs text-rose-600">{erro}</span> : null}
    </label>
  );
}
