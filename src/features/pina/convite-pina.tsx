"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { enviarConvitePina, type EstadoConvite } from "@/features/pina/convite-actions";

type Professor = { id: string; nome: string; email: string | null };

/**
 * O convite em massa — separado da liberação de acesso de propósito.
 *
 * São dois atos com consequências diferentes: liberar cria conta e não
 * incomoda ninguém; avisar chega na caixa de entrada de doze pessoas e não
 * tem desfazer. Juntar os dois num botão só faria a escola mandar e-mail sem
 * ter decidido mandar.
 */
export function ConvitePina({ professores }: { professores: Professor[] }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [estado, acao, enviando] = useActionState<EstadoConvite, FormData>(
    enviarConvitePina,
    {},
  );

  const comEmail = professores.filter((p) => p.email);
  const todos = comEmail.length > 0 && comEmail.every((p) => marcados.has(p.id));

  return (
    <form action={acao} className="space-y-4 rounded-lg border border-border p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Avisar a equipe sobre o Pina
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manda um e-mail contando o que é o Pina e como entrar. O texto sai da
          aba Comunicação — dá para reescrevê-lo antes de disparar.
        </p>
      </div>

      {estado.erro ? <Alert tone="danger">{estado.erro}</Alert> : null}

      {estado.ok ? (
        <Alert tone={estado.falhas?.length ? "warning" : "success"}>
          <p className="font-medium">
            {estado.enviados === 1
              ? "1 convite enviado."
              : `${estado.enviados} convites enviados.`}
          </p>
          {estado.semEmail?.length ? (
            <p className="mt-1">
              Sem e-mail no cadastro, não recebeu:{" "}
              <strong>{estado.semEmail.join(", ")}</strong>.
            </p>
          ) : null}
          {estado.falhas?.length ? (
            <ul className="mt-1 space-y-0.5">
              {estado.falhas.map((f) => (
                <li key={f.nome}>
                  {f.nome}: {f.motivo}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {marcados.size} de {comEmail.length} selecionados
        </span>
        <button
          type="button"
          onClick={() =>
            setMarcados(todos ? new Set() : new Set(comEmail.map((p) => p.id)))
          }
          className="text-sm text-primary hover:underline"
        >
          {todos ? "Desmarcar todos" : "Marcar todos"}
        </button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {professores.map((p) => (
          <li key={p.id}>
            <label
              className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                p.email ? "cursor-pointer hover:bg-muted/40" : "opacity-60"
              }`}
            >
              <input
                type="checkbox"
                name="staffId"
                value={p.id}
                disabled={!p.email}
                checked={marcados.has(p.id)}
                onChange={() =>
                  setMarcados((atual) => {
                    const nova = new Set(atual);
                    if (nova.has(p.id)) nova.delete(p.id);
                    else nova.add(p.id);
                    return nova;
                  })
                }
                className="h-4 w-4 accent-primary"
              />
              <span className="text-foreground">{p.nome}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {p.email ?? "sem e-mail no cadastro"}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <Button type="submit" disabled={enviando || marcados.size === 0}>
        <Send className="mr-2 h-4 w-4" />
        {enviando ? "Enviando…" : `Enviar convite${marcados.size > 1 ? "s" : ""}`}
      </Button>
    </form>
  );
}
