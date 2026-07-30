"use client";

import { useActionState, useState } from "react";
import {
  createCoreografia,
  type EspetaculoActionState,
} from "@/features/espetaculo/actions";
import {
  coreografiaTipoOptions,
  type CoreografiaTipo,
} from "@/features/espetaculo/schemas";

type Option = { id: string; nome: string };

const initial: EspetaculoActionState = {};

export function CoreografiaForm({
  espetaculoId,
  turmas,
  professores,
  alunos,
}: {
  espetaculoId: string;
  turmas: Option[];
  professores: Option[];
  alunos: Option[];
}) {
  const action = createCoreografia.bind(null, espetaculoId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [tipo, setTipo] = useState<CoreografiaTipo>("normal");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" name="nome" required error={state.errors?.nome?.[0]} />
        <Field label="Música (texto livre)" name="musica_texto" placeholder="Everybody - Backstreet Boys" />
        <label className="block">
          <span className="text-sm font-medium text-foreground">Tipo</span>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as CoreografiaTipo)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
          >
            {coreografiaTipoOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ordem" name="ordem" type="number" placeholder="0" />
          <Field label="Duração (s)" name="duracao_segundos" type="number" placeholder="opcional" />
        </div>
      </div>

      <CheckboxGroup label="Turmas" name="turma_ids" options={turmas} />
      <CheckboxGroup label="Professores" name="professor_ids" options={professores} />
      {tipo === "especial" ? (
        <CheckboxGroup label="Elenco manual (alunos)" name="aluno_ids" options={alunos} />
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Adicionar coreografia"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function CheckboxGroup({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: Option[];
}) {
  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium text-foreground">{label}</legend>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma opção disponível.</p>
      ) : (
        <div className="mt-1 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-y-auto">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name={name} value={o.id} className="h-4 w-4" />
              {o.nome}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
