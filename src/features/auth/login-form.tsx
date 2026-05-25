"use client";

import { useActionState } from "react";
import { login, type LoginActionState } from "@/features/auth/actions";

const initialState: LoginActionState = {};

type LoginFormProps = {
  message?: string;
};

export function LoginForm({ message }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const displayMessage = state.message ?? message;

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {displayMessage ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {displayMessage}
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-foreground">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
        />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
