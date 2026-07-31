"use client";

import { useState } from "react";
import {
  CoreografiaForm,
  type CoreografiaDefaults,
} from "@/features/espetaculo/coreografia-form";
import { DeleteCoreografiaButton } from "@/features/espetaculo/delete-coreografia-button";

type Option = { id: string; nome: string };

export type CoreografiaResumo = {
  ordem: number;
  nome: string;
  tipoLabel: string;
  musicaTexto: string | null;
  turmasStr: string;
  professoresStr: string;
};

export function CoreografiaEditor({
  espetaculoId,
  resumo,
  defaults,
  turmas,
  professores,
  alunos,
}: {
  espetaculoId: string;
  resumo: CoreografiaResumo;
  defaults: CoreografiaDefaults;
  turmas: Option[];
  professores: Option[];
  alunos: Option[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">
            <span className="mr-2 text-muted-foreground">{resumo.ordem}.</span>
            {resumo.nome}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {resumo.tipoLabel}
            </span>
          </p>
          {resumo.musicaTexto ? (
            <p className="mt-0.5 text-sm text-muted-foreground">🎵 {resumo.musicaTexto}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Turmas: {resumo.turmasStr || "—"} · Professores: {resumo.professoresStr || "—"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            {open ? "Fechar" : "Editar"}
          </button>
          <DeleteCoreografiaButton
            espetaculoId={espetaculoId}
            coreografiaId={defaults.coreografiaId}
          />
        </div>
      </div>

      {open ? (
        <div className="mt-4 border-t border-border pt-4">
          <CoreografiaForm
            espetaculoId={espetaculoId}
            turmas={turmas}
            professores={professores}
            alunos={alunos}
            edit={defaults}
          />
        </div>
      ) : null}
    </li>
  );
}
