"use client";

import { useState, useTransition } from "react";
import {
  provisionAllPinaAction,
  provisionPinaAction,
  type BackfillRow,
  type ProvisionOneState,
} from "@/features/pina/access-actions";

type Professor = { id: string; nome: string; email: string | null };

const ERROS: Record<string, string> = {
  sem_email: "Professor sem e-mail cadastrado.",
  email_em_outra_conta: "E-mail já usado por outra conta Firebase.",
  firebase_not_configured: "Firebase não configurado (env).",
  forbidden: "Sem permissão.",
  staff_not_found: "Professor não encontrado.",
};

export function PinaAccessManager({ professores }: { professores: Professor[] }) {
  const [pending, start] = useTransition();
  const [results, setResults] = useState<Record<string, ProvisionOneState>>({});
  const [backfill, setBackfill] = useState<BackfillRow[] | null>(null);

  function provisionOne(id: string) {
    start(async () => {
      const r = await provisionPinaAction(id);
      setResults((prev) => ({ ...prev, [id]: r }));
    });
  }
  function provisionAll() {
    start(async () => {
      const r = await provisionAllPinaAction();
      setBackfill(r.rows ?? []);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cria/atualiza a conta Firebase (uid = id do professor) e gera o link
          para o professor definir a senha. Envie o link ao professor.
        </p>
        <button
          type="button"
          onClick={provisionAll}
          disabled={pending}
          className="h-10 shrink-0 rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Processando…" : "Provisionar todos"}
        </button>
      </div>

      {backfill ? (
        <div className="rounded-md border border-border bg-white p-4 text-sm">
          <p className="mb-2 font-medium">Backfill:</p>
          <ul className="space-y-1">
            {backfill.map((r, i) => (
              <li key={i} className="text-muted-foreground">
                {r.status === "ok" ? "✅" : "⚠️"} {r.nome} — {ERROS[r.detail] ?? r.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Professor</th>
              <th className="px-4 py-3 font-semibold">E-mail</th>
              <th className="px-4 py-3 font-semibold">Acesso ao Pina</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {professores.map((p) => {
              const res = results[p.id];
              return (
                <tr key={p.id} className="align-top">
                  <td className="px-4 py-3 font-medium text-foreground">{p.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.email ?? <span className="text-amber-700">sem e-mail</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => provisionOne(p.id)}
                      disabled={pending || !p.email}
                      className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                    >
                      {res?.status === "ok" ? "Reenviar acesso" : "Enviar acesso"}
                    </button>
                    {res?.status === "ok" ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-emerald-700">
                          {res.created ? "Conta criada." : "Conta atualizada."} Copie e envie o link:
                        </p>
                        <input
                          readOnly
                          value={res.resetLink}
                          onFocus={(e) => e.currentTarget.select()}
                          className="w-full rounded border border-border bg-muted/40 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : null}
                    {res?.status === "error" ? (
                      <p className="mt-2 text-xs text-red-600">
                        {ERROS[res.error] ?? res.error}
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
