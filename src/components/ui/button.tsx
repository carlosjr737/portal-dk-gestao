import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Botão do portal.
 *
 * Substitui 17 variações de `className` que existiam espalhadas em 68 botões.
 * As diferenças entre elas eram quase todas acidentais — um `justify-center`
 * a mais aqui, um `disabled:cursor-not-allowed` esquecido ali —, mas o efeito
 * era real: botão desabilitado que não parecia desabilitado, e botão que
 * pulava de altura conforme a página.
 *
 * `asChild` não existe aqui de propósito: exigiria o @radix-ui/react-slot só
 * para envolver `<Link>`. Como o Next já pede `<Link>` para navegação, os
 * links usam `buttonVariants(...)` direto no `className` — mesmo visual, sem
 * dependência nova.
 */
export const buttonVariants = cva(
  // Base: o que todo botão tem. O anel de foco vem daqui, então nenhum botão
  // novo nasce invisível para quem navega por teclado.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Ação principal da tela. Uma por tela, idealmente. */
        default: "bg-primary text-primary-foreground hover:opacity-90",
        /** Ação destrutiva. Reservada a perigo — nunca a comando. */
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90",
        /**
         * Ação secundária: Voltar, Cancelar, Filtrar, Exportar, Limpar.
         *
         * Usa `border-input` e não `border-border`: este botão vive ao lado de
         * campos, e com a borda decorativa ele ficava visivelmente mais claro
         * que o campo vizinho na mesma linha.
         */
        outline:
          "border border-input bg-transparent text-foreground hover:bg-muted",
        /** Ênfase intermediária, em escuro (usado em Imprimir). */
        secondary: "bg-foreground text-white hover:opacity-90",
        /** Sem moldura, para ação terciária dentro de listas e cartões. */
        ghost: "text-foreground hover:bg-muted",
        /** Aparência de link, mantendo área de clique de botão. */
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        /** Altura padrão do portal — a mesma dos campos de formulário. */
        default: "h-10 px-4",
        sm: "h-9 px-3 text-sm",
        lg: "h-11 px-6",
        /** Quadrado, para botão só de ícone. */
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, type, ...props }, ref) {
    return (
      <button
        ref={ref}
        // Sem `type`, um <button> dentro de <form> submete. Como quase todo
        // formulário aqui roda server action, um botão de "Cancelar" sem type
        // salvava o registro. O padrão passa a ser o seguro.
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
