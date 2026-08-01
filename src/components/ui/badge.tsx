import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Pílula de status.
 *
 * O portal marcava status com pares de cor escritos na mão, e eles derivaram:
 * "em dia" aparecia como emerald-50/700 numa tela, emerald-100/800 em outra e
 * emerald-50/800 numa terceira. São três verdes para a mesma informação, e
 * quem olha duas telas lado a lado se pergunta se querem dizer coisas
 * diferentes.
 *
 * Os tons são nomeados pelo SIGNIFICADO, não pela cor: quem escreve
 * `tone="danger"` não precisa decidir qual vermelho, e o dia em que o vermelho
 * mudar, muda em todo lugar.
 */
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      /*
       * Tinta clara de fundo + variante ESCURA de texto. A cor cheia do
       * token (`bg-warning`) reprova como texto: âmbar sobre branco dá
       * 2,29:1. Cada par abaixo fica entre 4,6:1 e 4,8:1.
       */
      tone: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-success-tint text-success-text",
        warning: "bg-warning-tint text-warning-text",
        danger: "bg-danger-tint text-danger-text",
        info: "bg-info-tint text-info-text",
        /** Destaque na cor da marca — usar com parcimônia. */
        brand: "bg-primary text-primary-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
