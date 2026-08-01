import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Caixa de aviso — sucesso, atenção, erro, informação.
 *
 * Reúne ~25 caixas escritas à mão. Além da cor derivar (amber-800 aqui,
 * amber-700 ali), nenhuma delas se anunciava: mensagem de erro depois de
 * salvar aparecia na tela e não existia para quem usa leitor de tela.
 *
 * `role="alert"` nos tons de erro e atenção resolve isso — o leitor interrompe
 * e lê assim que a caixa aparece. Sucesso e informação usam `role="status"`,
 * que espera a pessoa terminar o que está fazendo.
 */
export const alertVariants = cva(
  "rounded-md border px-4 py-3 text-sm",
  {
    variants: {
      tone: {
        info: "border-border bg-muted text-foreground",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
        danger: "border-red-200 bg-red-50 text-red-700",
      },
    },
    defaultVariants: {
      tone: "info",
    },
  },
);

export type AlertProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants>;

export function Alert({ className, tone, role, ...props }: AlertProps) {
  const papel = role ?? (tone === "danger" || tone === "warning" ? "alert" : "status");

  return (
    <div
      role={papel}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  );
}
