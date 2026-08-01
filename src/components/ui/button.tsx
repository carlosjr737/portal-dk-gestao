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
  /*
   * Base: o que todo botão tem. O anel de foco vem daqui, então nenhum botão
   * novo nasce invisível para quem navega por teclado.
   *
   * Desabilitado é CINZA, não transparente. Era `opacity-60`, e isso falhava
   * de duas formas opostas: no botão de contorno, que já é quase todo branco,
   * 60% de opacidade quase não mudava nada — desabilitado e ativo ficavam
   * lado a lado praticamente iguais. No destrutivo, o vermelho a 60% virava
   * um marrom-rosado que não parece nem perigo nem indisponível.
   *
   * Cinza chapado diz a mesma coisa em todas as variantes: não está
   * disponível. Ghost e link desfazem o fundo mais abaixo, porque neles um
   * bloco cinza seria estranho.
   */
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition [&_svg]:size-4 [&_svg]:shrink-0 disabled:pointer-events-none disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground",
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
          // `border-input`, não `border-border`: senão o botão fica mais
          // claro que o campo ao lado dele na mesma linha de filtro.
          "border border-input bg-card text-foreground hover:bg-muted",
        /** Ênfase intermediária, em escuro (usado em Imprimir). */
        secondary: "bg-foreground text-white hover:opacity-90",
        /** Sem moldura, para ação terciária dentro de listas e cartões. */
        ghost: "text-foreground hover:bg-muted disabled:bg-transparent",
        /** Aparência de link, mantendo área de clique de botão. */
        link: "text-primary underline-offset-4 hover:underline disabled:bg-transparent",
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
