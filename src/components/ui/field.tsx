import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Rótulo + campo + mensagem de erro.
 *
 * Existe porque essa combinação estava reescrita à mão em sete arquivos
 * (`SelectField`, `Select`, `Field`...), cada um com um detalhe diferente. Um
 * deles mostrava o erro em `text-red-600`, outro não mostrava erro nenhum, e
 * em nenhum o erro estava LIGADO ao campo — quem usa leitor de tela ouvia
 * "Nome, caixa de texto" e nunca a mensagem que estava logo abaixo.
 *
 * Aqui o erro é ligado por `aria-describedby` e o campo é marcado com
 * `aria-invalid`, então o leitor anuncia o problema junto com o campo.
 */
type FieldProps = {
  label: string;
  /** Id do controle. Gerado automaticamente se não vier. */
  htmlFor?: string;
  error?: string | null;
  /** Texto de apoio abaixo do rótulo (ex.: formato esperado). */
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useId();
  // Precedência: id explícito do campo > htmlFor > id gerado. Sem isto, um
  // campo que já tinha id (porque outra coisa aponta para ele) perderia o seu
  // e a referência quebraria em silêncio.
  const idDoFilho = React.isValidElement<{ id?: string }>(children)
    ? children.props.id
    : undefined;
  const id = idDoFilho ?? htmlFor ?? generatedId;
  const errorId = `${id}-erro`;
  const hintId = `${id}-ajuda`;

  return (
    <div className={cn("block", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="mt-1">
        {/*
          Injeta id e as ligações de acessibilidade no controle, para a página
          não ter que repetir isso em cada campo — que é justamente o passo que
          ninguém lembra de dar.
        */}
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
              id,
              "aria-invalid": error ? true : undefined,
              "aria-describedby":
                [hint ? hintId : null, error ? errorId : null]
                  .filter(Boolean)
                  .join(" ") || undefined,
            })
          : children}
      </div>

      {/*
        Ajuda e erro vêm DEPOIS do campo, não entre o rótulo e ele.
        Antes o hint ficava no meio e empurrava só o campo que o tinha para
        baixo: numa grade de duas colunas, "Nome completo" e "CPF" ficavam em
        alturas diferentes na mesma linha, e a leitura de que são um par se
        perdia. Agora a distância rótulo→campo é sempre 4px, então todos os
        campos de uma linha alinham independentemente do que vem embaixo.

        Para leitor de tela não muda nada: quem liga o texto ao campo é o
        aria-describedby, não a posição no DOM.
      */}
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
