"use client";

import { useActionState } from "react";
import type { StaffActionState } from "@/features/staff/actions";
import {
  staffRoleOptions,
  staffStatusOptions,
  type StaffMemberFormData,
} from "@/features/staff/schemas";

type StaffMemberFormProps = {
  action: (
    previousState: StaffActionState,
    formData: FormData,
  ) => Promise<StaffActionState>;
  defaultValues?: Partial<StaffMemberFormData>;
  submitLabel: string;
  compact?: boolean;
};

const initialState: StaffActionState = {};

export function StaffMemberForm({
  action,
  defaultValues,
  submitLabel,
  compact,
}: StaffMemberFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className={compact ? "space-y-3" : "mt-6 max-w-4xl space-y-4"}
    >
      {state.message ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Nome completo"
          name="full_name"
          defaultValue={defaultValues?.full_name ?? ""}
          error={state.errors?.full_name?.[0]}
          required
        />
        <Field
          label="Nome artístico"
          name="artistic_name"
          defaultValue={defaultValues?.artistic_name ?? ""}
          error={state.errors?.artistic_name?.[0]}
        />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ""}
          error={state.errors?.email?.[0]}
        />
        <Field
          label="Telefone"
          name="phone"
          defaultValue={defaultValues?.phone ?? ""}
          error={state.errors?.phone?.[0]}
        />
        <SelectField
          label="Função"
          name="role"
          defaultValue={defaultValues?.role ?? "professor"}
          options={staffRoleOptions}
          error={state.errors?.role?.[0]}
        />
        <SelectField
          label="Status"
          name="status"
          defaultValue={defaultValues?.status ?? "active"}
          options={staffStatusOptions}
          error={state.errors?.status?.[0]}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Salvando..." : submitLabel}
      </button>
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
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
      />
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
};

function SelectField({
  label,
  name,
  defaultValue,
  options,
  error,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}
