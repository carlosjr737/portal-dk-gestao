"use client";

import { useActionState } from "react";
import { login, type LoginActionState } from "@/features/auth/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
        <Alert tone="warning">{displayMessage}</Alert>
      ) : null}

      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="email" required className="h-11" />
      </Field>

      <Field label="Senha">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
        />
      </Field>

      {/* Entrar é a ação principal da tela — variante primária, cobalto. */}
      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
