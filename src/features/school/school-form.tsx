"use client";

import { useActionState } from "react";
import { updateSchool, type SchoolActionState } from "@/features/school/actions";

export type SchoolData = {
  nome: string;
  razao_social: string | null;
  representante_legal: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

const initial: SchoolActionState = {};

export function SchoolForm({ school }: { school: SchoolData }) {
  const [state, formAction, pending] = useActionState(updateSchool, initial);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Identificação
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Nome da escola"
            name="nome"
            defaultValue={school.nome}
            required
            error={state.errors?.nome?.[0]}
          />
          <Field
            label="Razão social"
            name="razao_social"
            defaultValue={school.razao_social}
            hint="Usada no contrato do aluno"
          />
          <Field
            label="Representante legal"
            name="representante_legal"
            defaultValue={school.representante_legal}
            hint="Quem assina o contrato como CONTRATADO"
          />
          <Field label="CNPJ" name="cnpj" defaultValue={school.cnpj} />
          <Field label="Telefone" name="telefone" defaultValue={school.telefone} />
          <Field
            label="E-mail"
            name="email"
            defaultValue={school.email}
            className="sm:col-span-2"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Endereço
        </h3>
        <div className="grid gap-3 sm:grid-cols-6">
          <Field label="CEP" name="cep" defaultValue={school.cep} className="sm:col-span-2" />
          <Field
            label="Logradouro"
            name="logradouro"
            defaultValue={school.logradouro}
            className="sm:col-span-4"
          />
          <Field label="Número" name="numero" defaultValue={school.numero} className="sm:col-span-1" />
          <Field
            label="Complemento"
            name="complemento"
            defaultValue={school.complemento}
            className="sm:col-span-2"
          />
          <Field label="Bairro" name="bairro" defaultValue={school.bairro} className="sm:col-span-3" />
          <Field label="Cidade" name="cidade" defaultValue={school.cidade} className="sm:col-span-5" />
          <Field label="UF" name="uf" defaultValue={school.uf} className="sm:col-span-1" />
        </div>
      </section>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar dados da escola"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  className = "",
  required,
  error,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  className?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
      />
      {hint ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span> : null}
      {error ? <span className="mt-0.5 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
