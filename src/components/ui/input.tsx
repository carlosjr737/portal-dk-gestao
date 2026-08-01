import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Campo de texto.
 *
 * Unifica 6 variações que existiam em 38 campos. As diferenças eram descuido
 * acumulado: alguns campos não tinham `text-foreground` (herdavam a cor do
 * contêiner), outros não tinham `transition`, e nenhum tinha estado de
 * desabilitado consistente.
 *
 * O `mt-1` que aparecia colado em quase todos NÃO veio para cá: era espaçamento
 * em relação ao rótulo, e isso é assunto do <Field>, não do campo.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition",
          "placeholder:text-muted-foreground",
          "focus:border-primary",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          // Campo de arquivo não tem altura de linha própria; sem isto o texto
          // fica colado no topo da moldura.
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className,
        )}
        {...props}
      />
    );
  },
);
