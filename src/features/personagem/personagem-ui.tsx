"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import {
  createPersonagem,
  deletePersonagem,
  updatePersonagem,
  type PersonagemActionState,
} from "@/features/personagem/actions";
import { Input } from "@/components/ui/input";

export type AlunoOption = { id: string; nome: string };
export type PersonagemItem = {
  id: string;
  nome: string;
  cor: string;
  aluno_id: string | null;
};

const initial: PersonagemActionState = {};

/** Combobox com busca: digita pra filtrar, escreve o aluno_id num input oculto. */
function AlunoCombobox({
  name,
  alunos,
  defaultId,
}: {
  name: string;
  alunos: AlunoOption[];
  defaultId?: string | null;
}) {
  const byId = useMemo(() => new Map(alunos.map((a) => [a.id, a.nome])), [alunos]);
  const [selectedId, setSelectedId] = useState<string>(defaultId ?? "");
  const [query, setQuery] = useState<string>(
    defaultId ? (byId.get(defaultId) ?? "") : "",
  );
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return alunos.slice(0, 30);
    return alunos.filter((a) => a.nome.toLowerCase().includes(q)).slice(0, 30);
  }, [alunos, q]);

  function pick(a: AlunoOption) {
    setSelectedId(a.id);
    setQuery(a.nome);
    setOpen(false);
  }
  function clear() {
    setSelectedId("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selectedId} />
      <div className="flex items-center gap-1">
        <Input
          type="text"
          value={query}
          placeholder="Buscar aluno… (opcional)"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(""); // digitar invalida a seleção até clicar de novo
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          className="h-9 w-56 px-2"
        />
        {selectedId || query ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Limpar aluno"
            className="h-9 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        ) : null}
      </div>
      {open && matches.length > 0 ? (
        <ul
          className="absolute z-20 mt-1 max-h-56 w-56 overflow-auto rounded-md border border-border bg-white py-1 shadow-lg"
          onMouseDown={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {matches.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => pick(a)}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-muted ${
                  a.id === selectedId ? "bg-muted font-medium" : ""
                }`}
              >
                {a.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PersonagemCreate({
  espetaculoId,
  alunos,
}: {
  espetaculoId: string;
  alunos: AlunoOption[];
}) {
  const [state, action, pending] = useActionState(createPersonagem, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="espetaculo_id" value={espetaculoId} />
      {state.message ? (
        <p className="w-full text-sm text-muted-foreground">{state.message}</p>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-foreground">Nome do personagem</span>
        <Input
          name="nome"
          required
          placeholder="Morticia"
          className="h-9 w-56"
        />
        {state.errors?.nome?.[0] ? (
          <span className="block text-xs text-red-600">{state.errors.nome[0]}</span>
        ) : null}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-foreground">Cor</span>
        <Input
          name="cor"
          type="color"
          defaultValue="#8b5cf6"
          className="h-9 w-16 cursor-pointer"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-foreground">Aluno (opcional)</span>
        <AlunoCombobox name="aluno_id" alunos={alunos} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Criando…" : "Adicionar personagem"}
      </button>
    </form>
  );
}

export function PersonagemRow({
  espetaculoId,
  personagem,
  alunos,
}: {
  espetaculoId: string;
  personagem: PersonagemItem;
  alunos: AlunoOption[];
}) {
  const [state, action, pending] = useActionState(
    updatePersonagem.bind(null, personagem.id),
    initial,
  );
  return (
    <tr className="align-middle">
      <td className="px-4 py-2">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="espetaculo_id" value={espetaculoId} />
          <span
            className="inline-block h-5 w-5 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: personagem.cor }}
          />
          <Input
            name="nome"
            defaultValue={personagem.nome}
            required
            className="h-9 w-44 px-2"
          />
          <Input
            name="cor"
            type="color"
            defaultValue={personagem.cor}
            className="h-9 w-12 cursor-pointer"
          />
          <AlunoCombobox name="aluno_id" alunos={alunos} defaultId={personagem.aluno_id} />
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-md border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
          {state.message ? (
            <span className="text-xs text-muted-foreground">{state.message}</span>
          ) : null}
        </form>
      </td>
      <td className="px-4 py-2 text-right align-top">
        <form action={deletePersonagem.bind(null, personagem.id, espetaculoId)}>
          <button
            type="submit"
            className="h-9 rounded-md border border-rose-200 px-3 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
          >
            Excluir
          </button>
        </form>
      </td>
    </tr>
  );
}
