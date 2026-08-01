import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lista de seleção.
 *
 * É o `<select>` nativo, NÃO o Select do Radix que vem no shadcn. A escolha é
 * deliberada e vale registrar, porque o caminho "certo" pelo manual seria o
 * outro:
 *
 * - O do Radix é client component. Metade dos formulários daqui são server
 *   components que dependem de `name` + server action; trocar obrigaria a
 *   marcar tudo como `"use client"` e a espelhar valor em estado.
 * - No celular, o nativo abre o seletor do sistema — roda de polegar, sem
 *   travar em lista com 400 alunos. O do Radix desenha uma lista HTML.
 * - Sem JavaScript ele continua funcionando.
 *
 * A troca faz sentido no dia em que precisarmos de busca dentro da lista ou de
 * opção com duas linhas. Hoje não precisamos, e o nativo é melhor.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition",
          "focus:border-primary",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
