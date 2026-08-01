"use client";

import { useActionState } from "react";
import { createEspetaculo, type EspetaculoActionState } from "@/features/espetaculo/actions";
import { Button } from "@/components/ui/button";

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
        <input
          name="nome"
          required
          placeholder="Festival 1 / 2026"
          className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        />
        {state.errors?.nome?.[0] ? (
          <span className="text-xs text-red-600">{state.errors.nome[0]}</span>
        ) : null}
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">Temporada</span>
        <input
          name="temporada"
          placeholder="opcional"
          className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">Data do evento</span>
        <input
          name="data_evento"
          type="date"
          className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
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
