"use client";

import { useActionState } from "react";
import {
  createPersonagem,
  deletePersonagem,
  updatePersonagem,
  type PersonagemActionState,
} from "@/features/personagem/actions";

export type AlunoOption = { id: string; nome: string };
export type PersonagemItem = {
  id: string;
  nome: string;
  cor: string;
  aluno_id: string | null;
};

const initial: PersonagemActionState = {};

function AlunoSelect({
  name,
  alunos,
  defaultValue,
}: {
  name: string;
  alunos: AlunoOption[];
  defaultValue?: string | null;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className="h-10 rounded-md border border-border bg-white px-2 text-sm outline-none focus:border-primary"
    >
      <option value="">— Sem aluno (papel livre) —</option>
      {alunos.map((a) => (
        <option key={a.id} value={a.id}>{a.nome}</option>
      ))}
    </select>
  );
}

export function PersonagemCreate({ alunos }: { alunos: AlunoOption[] }) {
  const [state, action, pending] = useActionState(createPersonagem, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {state.message ? (
        <p className="w-full text-sm text-muted-foreground">{state.message}</p>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium text-foreground">Nome do personagem</span>
        <input
          name="nome"
          required
          placeholder="Morticia"
          className="mt-1 h-10 w-56 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary"
        />
        {state.errors?.nome?.[0] ? (
          <span className="block text-xs text-red-600">{state.errors.nome[0]}</span>
        ) : null}
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">Cor</span>
        <input
          name="cor"
          type="color"
          defaultValue="#8b5cf6"
          className="mt-1 h-10 w-16 cursor-pointer rounded-md border border-border bg-white"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-foreground">Aluno (opcional)</span>
        <div className="mt-1">
          <AlunoSelect name="aluno_id" alunos={alunos} />
        </div>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Criando…" : "Adicionar personagem"}
      </button>
    </form>
  );
}

export function PersonagemRow({
  personagem,
  alunos,
}: {
  personagem: PersonagemItem;
  alunos: AlunoOption[];
}) {
  const [state, action, pending] = useActionState(
    updatePersonagem.bind(null, personagem.id),
    initial,
  );
  return (
    <tr className="align-middle">
      <td className="px-4 py-2" colSpan={4}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <span
            className="inline-block h-5 w-5 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: personagem.cor }}
          />
          <input
            name="nome"
            defaultValue={personagem.nome}
            required
            className="h-9 w-48 rounded-md border border-border bg-white px-2 text-sm outline-none focus:border-primary"
          />
          <input
            name="cor"
            type="color"
            defaultValue={personagem.cor}
            className="h-9 w-12 cursor-pointer rounded-md border border-border bg-white"
          />
          <AlunoSelect name="aluno_id" alunos={alunos} defaultValue={personagem.aluno_id} />
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
      <td className="px-4 py-2 text-right">
        <form action={deletePersonagem.bind(null, personagem.id)}>
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
