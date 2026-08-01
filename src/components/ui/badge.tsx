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
      tone: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-emerald-50 text-emerald-700",
        warning: "bg-amber-50 text-amber-800",
        danger: "bg-red-50 text-red-700",
        info: "bg-sky-50 text-sky-700",
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
