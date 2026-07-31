"use client";

import { useActionState } from "react";
import { criarSubcontaPreview, type CriarSubcontaState } from "@/features/baas/actions";
import { AsaasSelo } from "@/components/brand/asaas-selo";

const initial: CriarSubcontaState = {};

export function SubcontaPreviewForm() {
  const [state, formAction, pending] = useActionState(criarSubcontaPreview, initial);

  return (
    <form action={formAction} className="w-full max-w-xl rounded-lg border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">Criar sub-conta da escola</h2>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          sandbox
        </span>
      </div>

      <div className="space-y-5 px-6 py-5">
        {state.message ? (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              state.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {state.message}
            {state.subconta ? (
              <span className="mt-1 block font-mono text-xs">
                id: {state.subconta.id} · walletId: {state.subconta.walletId}
              </span>
            ) : null}
          </p>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dados da escola
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome da escola" name="name" placeholder="Ex.: DK Studio" defaultValue={state.values?.name} error={state.errors?.name?.[0]} />
            <Field label="CNPJ/CPF" name="cpfCnpj" placeholder="Somente números" defaultValue={state.values?.cpfCnpj} error={state.errors?.cpfCnpj?.[0]} />
            <Field label="E-mail financeiro" name="email" placeholder="financeiro@escola.com.br" defaultValue={state.values?.email} error={state.errors?.email?.[0]} />
            <Field label="Celular" name="mobilePhone" placeholder="(00) 00000-0000" defaultValue={state.values?.mobilePhone} error={state.errors?.mobilePhone?.[0]} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dados comerciais
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Faturamento mensal"
              name="incomeValue"
              type="number"
              placeholder="0,00"
              defaultValue={state.values?.incomeValue}
              error={state.errors?.incomeValue?.[0]}
            />
            <label className="block">
              <span className="text-xs font-medium text-foreground">Tipo de empresa</span>
              <select
                name="companyType"
                // key força o remount pra o defaultValue reaplicar após o re-render da action
                key={state.values?.companyType ?? "vazio"}
                defaultValue={state.values?.companyType ?? ""}
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Selecione…</option>
                <option value="MEI">MEI</option>
                <option value="LIMITED">Ltda</option>
                <option value="INDIVIDUAL">Empresário individual</option>
                <option value="ASSOCIATION">Associação</option>
              </select>
              {state.errors?.companyType?.[0] ? (
                <span className="text-xs text-red-600">{state.errors.companyType[0]}</span>
              ) : null}
            </label>
            <Field
              label="Site da escola (opcional)"
              name="site"
              placeholder="https://…"
              defaultValue={state.values?.site}
              className="col-span-2"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Endereço
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="CEP" name="postalCode" placeholder="Somente números" defaultValue={state.values?.postalCode} error={state.errors?.postalCode?.[0]} />
            <Field label="Rua" name="address" placeholder="Rua/Avenida" className="col-span-2" defaultValue={state.values?.address} error={state.errors?.address?.[0]} />
            <Field label="Número" name="addressNumber" placeholder="0000" defaultValue={state.values?.addressNumber} error={state.errors?.addressNumber?.[0]} />
            <Field label="Bairro" name="province" placeholder="Bairro" className="col-span-2" defaultValue={state.values?.province} error={state.errors?.province?.[0]} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        <AsaasSelo variant="azul" />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Criando…" : "Criar sub-conta"}
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
  className = "",
  error,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  className?: string;
  error?: string;
  defaultValue?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
