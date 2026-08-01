"use client";

import { useState, useTransition } from "react";
import {
  provisionAllPinaAction,
  provisionPinaAction,
  type BackfillRow,
  type ProvisionOneState,
} from "@/features/pina/access-actions";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

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
          para o professor definir a senha (página do Pina). O link{" "}
          <strong>expira em ~1h</strong> — gere e envie na hora.{" "}
          <span className="text-muted-foreground/80">
            “Provisionar todos” só cria/atualiza as contas, sem gerar links.
          </span>
        </p>
        <Button
          variant="secondary"
          type="button"
          onClick={provisionAll}
          disabled={pending}
          className="shrink-0"
        >
          {pending ? "Processando…" : "Provisionar todos"}
        </Button>
      </div>

      {backfill ? (
        <Card className="p-4 text-sm">
          <p className="mb-2 font-medium">Backfill:</p>
          <ul className="space-y-1">
            {backfill.map((r, i) => (
              <li key={i} className="text-muted-foreground">
                {r.status === "ok" ? "✅" : "⚠️"} {r.nome} — {ERROS[r.detail] ?? r.detail}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Professor</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Acesso ao Pina</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {professores.length > 0 ? (
            professores.map((p) => {
              const res = results[p.id];
              return (
                <TableRow key={p.id} className="align-top">
                  <TableCell className="font-medium text-foreground">{p.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.email ?? <span className="text-amber-700">sem e-mail</span>}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => provisionOne(p.id)}
                      disabled={pending || !p.email}
                    >
                      {res?.status === "ok" ? "Reenviar acesso" : "Enviar acesso"}
                    </Button>
                    {res?.status === "ok" ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-emerald-700">
                          {res.created ? "Conta criada." : "Conta atualizada."} Copie e envie o link:
                        </p>
                        <Input
                          readOnly
                          value={res.resetLink}
                          onFocus={(e) => e.currentTarget.select()}
                          className="bg-muted/40 px-2 py-1 text-xs"
                        />
                        <p className="text-xs text-amber-700">⏱ Expira em ~1h — envie agora.</p>
                      </div>
                    ) : null}
                    {res?.status === "error" ? (
                      <p className="mt-2 text-xs text-red-600">
                        {ERROS[res.error] ?? res.error}
                      </p>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableEmpty colSpan={3}>Nenhum professor encontrado.</TableEmpty>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
