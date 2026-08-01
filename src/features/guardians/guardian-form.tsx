"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { GuardianActionState } from "@/features/guardians/actions";
import type { GuardianFormData } from "@/features/guardians/schemas";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field as FormField } from "@/components/ui/field";

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
        <span className="text-sm font-medium text-foreground">
          Endereço (usado no contrato)
        </span>
        <Textarea
          name="address"
          defaultValue={defaultValues?.address ?? ""}
          rows={2}
          placeholder="Rua, número, complemento. Bairro. Cidade. UF. CEP: 00000000."
          className="mt-1"
        />
        {state.errors?.address?.[0] ? (
          <span className="mt-1 block text-xs text-red-600">
            {state.errors.address[0]}
          </span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Observações</span>
        <Textarea
          name="notes"
          defaultValue={defaultValues?.notes ?? ""}
          rows={5}
          className="mt-1"
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
          className={buttonVariants({ variant: "outline" })}
        >
          Cancelar
        </Link>
        <Button
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Salvando..." : submitLabel}
        </Button>
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
    <FormField label={label} error={error} required={required}>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="py-2"
      />
    </FormField>
  );
}
