"use client";

import { useActionState } from "react";
import { createEspetaculo, type EspetaculoActionState } from "@/features/espetaculo/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: EspetaculoActionState = {};

export function EspetaculoForm() {
  const [state, action, pending] = useActionState(createEspetaculo, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      {state.message ? (
        <p className="sm:col-span-3 text-sm text-muted-foreground">{state.message}</p>
      ) : null}
      <label className="block sm:col-span-1">
        <span className="text-sm font-medium text-foreground">Nome</span>
        <Input
          name="nome"
          required
          placeholder="Festival 1 / 2026"
          className="mt-1"
        />
        {state.errors?.nome?.[0] ? (
          <span className="text-xs text-red-600">{state.errors.nome[0]}</span>
        ) : null}
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">Temporada</span>
        <Input
          name="temporada"
          placeholder="opcional"
          className="mt-1"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">Data do evento</span>
        <Input
          name="data_evento"
          type="date"
          className="mt-1"
        />
      </label>
      <div className="sm:col-span-3">
        <Button
          type="submit"
          disabled={pending}
        >
          {pending ? "Criando…" : "Criar espetáculo"}
        </Button>
      </div>
    </form>
  );
}
