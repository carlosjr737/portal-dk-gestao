"use client";

import { useActionState, useEffect, useState } from "react";
import type { RoomActionState } from "@/features/rooms/actions";
import type { RoomFormData } from "@/features/rooms/schemas";

type RoomFormProps = {
  action: (
    previousState: RoomActionState,
    formData: FormData,
  ) => Promise<RoomActionState>;
  defaultValues?: Partial<RoomFormData>;
  submitLabel: string;
  compact?: boolean;
};

const initialState: RoomActionState = {};

export function RoomForm({
  action,
  defaultValues,
  submitLabel,
  compact,
}: RoomFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [slug, setSlug] = useState(defaultValues?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultValues?.slug));

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  return (
    <form
      action={formAction}
      className={compact ? "space-y-3" : "mt-6 max-w-5xl space-y-4"}
    >
      {state.message ? (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Nome da sala</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
          />
          {state.errors?.name?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.name[0]}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Slug</span>
          <input
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            required
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
          />
          {state.errors?.slug?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.slug[0]}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Capacidade</span>
          <input
            name="capacity"
            type="number"
            min="1"
            defaultValue={String(defaultValues?.capacity ?? "")}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
          />
          {state.errors?.capacity?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.capacity[0]}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Cor</span>
          <div className="mt-1 flex h-10 overflow-hidden rounded-md border border-border bg-white">
            <input
              name="color"
              type="color"
              defaultValue={defaultValues?.color ?? "#dbeafe"}
              className="h-10 w-14 border-0 bg-transparent p-1"
            />
            <span className="flex items-center px-3 text-xs text-muted-foreground">
              Usada no cabeçalho da sala.
            </span>
          </div>
          {state.errors?.color?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.color[0]}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Ordem</span>
          <input
            name="sort_order"
            type="number"
            defaultValue={String(defaultValues?.sort_order ?? 0)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
          />
          {state.errors?.sort_order?.[0] ? (
            <span className="mt-1 block text-xs text-red-600">
              {state.errors.sort_order[0]}
            </span>
          ) : null}
        </label>

        <label className="flex h-10 items-center gap-2 self-end rounded-md border border-border px-3 text-sm font-medium text-foreground">
          <input
            name="active"
            type="checkbox"
            defaultChecked={defaultValues?.active ?? true}
            className="h-4 w-4"
          />
          Ativa
        </label>
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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
