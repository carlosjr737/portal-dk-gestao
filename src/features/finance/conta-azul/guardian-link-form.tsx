"use client";

import { useActionState } from "react";
import type { ContaAzulGuardianLinkActionState } from "@/features/finance/conta-azul/guardian-link-actions";

type ContaAzulGuardianLinkFormProps = {
  action: (
    previousState: ContaAzulGuardianLinkActionState,
    formData: FormData,
  ) => Promise<ContaAzulGuardianLinkActionState>;
  hasContaAzulLink: boolean;
};

const initialState: ContaAzulGuardianLinkActionState = {};

export function ContaAzulGuardianLinkForm({
  action,
  hasContaAzulLink,
}: ContaAzulGuardianLinkFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      {state.message ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? "Verificando..."
          : hasContaAzulLink
            ? "Atualizar vínculo Conta Azul"
            : "Vincular ao Conta Azul"}
      </button>
    </form>
  );
}
