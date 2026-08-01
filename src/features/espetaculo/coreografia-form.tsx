"use client";

import { useActionState, useState } from "react";
import {
  createCoreografia,
  updateCoreografia,
  type EspetaculoActionState,
} from "@/features/espetaculo/actions";
import {
  coreografiaTipoOptions,
  type CoreografiaTipo,
} from "@/features/espetaculo/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field as FormField } from "@/components/ui/field";

type Option = { id: string; nome: string };

export type CoreografiaDefaults = {
  coreografiaId: string;
  nome: string;
  tipo: CoreografiaTipo;
  musica_texto: string;
  audio_url: string;
  ordem: number;
  duracao_segundos: number | null;
  turmaIds: string[];
  professorIds: string[];
  alunoIds: string[];
};

const initial: EspetaculoActionState = {};

export function CoreografiaForm({
  espetaculoId,
  turmas,
  professores,
  alunos,
  edit,
}: {
  espetaculoId: string;
  turmas: Option[];
  professores: Option[];
  alunos: Option[];
  edit?: CoreografiaDefaults;
}) {
  const action = edit
    ? updateCoreografia.bind(null, espetaculoId, edit.coreografiaId)
    : createCoreografia.bind(null, espetaculoId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [tipo, setTipo] = useState<CoreografiaTipo>(edit?.tipo ?? "normal");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      ) : null}

      {/* audio_url ainda não tem campo próprio — preserva o valor atual na edição. */}
      <input type="hidden" name="audio_url" defaultValue={edit?.audio_url ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Nome"
          name="nome"
          required
          defaultValue={edit?.nome}
          error={state.errors?.nome?.[0]}
        />
        <Field
          label="Música (texto livre)"
          name="musica_texto"
          placeholder="Everybody - Backstreet Boys"
          defaultValue={edit?.musica_texto}
        />
        <label className="block">
          <span className="text-sm font-medium text-foreground">Tipo</span>
          <Select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as CoreografiaTipo)}
            className="mt-1"
          >
            {coreografiaTipoOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Ordem"
            name="ordem"
            type="number"
            placeholder="0"
            defaultValue={edit ? String(edit.ordem) : undefined}
          />
          <Field
            label="Duração (s)"
            name="duracao_segundos"
            type="number"
            placeholder="opcional"
            defaultValue={
              edit?.duracao_segundos != null ? String(edit.duracao_segundos) : undefined
            }
          />
        </div>
      </div>

      <CheckboxGroup
        label="Turmas"
        name="turma_ids"
        options={turmas}
        selected={edit?.turmaIds}
      />
      <CheckboxGroup
        label="Professores"
        name="professor_ids"
        options={professores}
        selected={edit?.professorIds}
      />
      {tipo === "especial" ? (
        <CheckboxGroup
          label="Elenco manual (alunos)"
          name="aluno_ids"
          options={alunos}
          selected={edit?.alunoIds}
        />
      ) : null}

      <div>
        <Button
          type="submit"
          disabled={pending}
        >
          {pending
            ? "Salvando…"
            : edit
              ? "Salvar alterações"
              : "Adicionar coreografia"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  error,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  defaultValue?: string;
}) {
  return (
    <FormField label={label} error={error} required={required}>
      <Input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
      />
    </FormField>
  );
}

function CheckboxGroup({
  label,
  name,
  options,
  selected,
}: {
  label: string;
  name: string;
  options: Option[];
  selected?: string[];
}) {
  const checkedSet = new Set(selected ?? []);
  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium text-foreground">{label}</legend>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma opção disponível.</p>
      ) : (
        <div className="mt-1 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-y-auto">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name={name}
                value={o.id}
                defaultChecked={checkedSet.has(o.id)}
                className="h-4 w-4"
              />
              {o.nome}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
