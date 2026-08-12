"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { enviarConvitePina, type EstadoConvite } from "@/features/pina/convite-actions";

type Pessoa = {
  uid: string;
  nome: string;
  email: string | null;
  papelNoPina: "professor" | "master";
  origem: "professor" | "usuario" | "ambos";
  semTurmas: boolean;
};

/**
 * O convite em massa — separado da liberação de acesso de propósito.
 *
 * São dois atos com consequências diferentes: liberar cria conta e não
 * incomoda ninguém; avisar chega na caixa de entrada de doze pessoas e não
 * tem desfazer. Juntar os dois num botão só faria a escola mandar e-mail sem
 * ter decidido mandar.
 */
export function ConvitePina({ pessoas }: { pessoas: Pessoa[] }) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [estado, acao, enviando] = useActionState<EstadoConvite, FormData>(
    enviarConvitePina,
    {},
  );

  const comEmail = pessoas.filter((p) => p.email);
  const todos = comEmail.length > 0 && comEmail.every((p) => marcados.has(p.uid));

  return (
    <form action={acao} className="space-y-4 rounded-lg border border-border p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Avisar a equipe sobre o Pina
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cria a conta de cada um no Pina e manda um e-mail com o link para
          definir a senha. <strong>Funciona para quem não tem acesso ao
          SouAle</strong>. A lista junta os professores e os usuários do
          sistema — os dois cadastros. O texto sai da aba Comunicação, dá para
          reescrevê-lo antes de disparar.
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
            setMarcados(todos ? new Set() : new Set(comEmail.map((p) => p.uid)))
          }
          className="text-sm text-primary hover:underline"
        >
          {todos ? "Desmarcar todos" : "Marcar todos"}
        </button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
        {pessoas.map((p) => (
          <li key={p.uid}>
            <label
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm ${
                p.email ? "cursor-pointer hover:bg-muted/40" : "opacity-60"
              }`}
            >
              <input
                type="checkbox"
                name="staffId"
                value={p.uid}
                disabled={!p.email}
                checked={marcados.has(p.uid)}
                onChange={() =>
                  setMarcados((atual) => {
                    const nova = new Set(atual);
                    if (nova.has(p.uid)) nova.delete(p.uid);
                    else nova.add(p.uid);
                    return nova;
                  })
                }
                className="h-4 w-4 accent-primary"
              />
              <span className="text-foreground">{p.nome}</span>

              {/* "master" enxerga a escola inteira no Pina; professor vê só as
                  turmas dele. Dizer isso aqui evita liberar sem perceber. */}
              {p.papelNoPina === "master" ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  vê tudo
                </span>
              ) : null}

              {/*
                Perfil sem ficha de professor não tem turma — o Pina abre vazio
                e a pessoa acha que o acesso quebrou. Melhor avisar antes de
                mandar o convite do que explicar depois.
              */}
              {p.semTurmas ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                  sem turma — cadastre em Professores
                </span>
              ) : null}

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
