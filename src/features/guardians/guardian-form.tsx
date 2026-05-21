"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { GuardianActionState } from "@/features/guardians/actions";
import type { GuardianFormData } from "@/features/guardians/schemas";

type GuardianFormProps = {
  action: (
    previousState: GuardianActionState,
    formData: FormData,
  ) => Promise<GuardianActionState>;
  defaultValues?: Partial<GuardianFormData>;
  submitLabel: string;
};

const initialState: GuardianActionState = {};

export function GuardianForm({
  action,
  defaultValues,
  submitLabel,
}: GuardianFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-6 max-w-3xl space-y-6">
      {state.message ? (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nome completo"
          name="full_name"
          defaultValue={defaultValues?.full_name ?? ""}
          error={state.errors?.full_name?.[0]}
          required
        />
        <Field
          label="Documento"
          name="document"
          defaultValue={defaultValues?.document ?? ""}
          error={state.errors?.document?.[0]}
        />
        <Field
          label="Telefone"
          name="phone"
          defaultValue={defaultValues?.phone ?? ""}
          error={state.errors?.phone?.[0]}
        />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ""}
          error={state.errors?.email?.[0]}
        />
      </div>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Observações</span>
        <textarea
          name="notes"
          defaultValue={defaultValues?.notes ?? ""}
          rows={5}
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
        />
        {state.errors?.notes?.[0] ? (
          <span className="mt-1 block text-xs text-red-600">
            {state.errors.notes[0]}
          </span>
        ) : null}
      </label>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Link
          href="/responsaveis"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
  error?: string;
  required?: boolean;
};

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  error,
  required,
}: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}
