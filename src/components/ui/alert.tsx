import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
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
 *
 * O ÍCONE não é enfeite: alerta nunca deve depender só de cor. Para quem não
 * distingue verde de âmbar — e são cerca de 8% dos homens —, "Chamada salva" e
 * "Matrícula sem responsável" eram a mesma caixa cinza-clara. A forma do ícone
 * carrega a informação que a cor sozinha não carrega.
 */
export const alertVariants = cva(
  "flex gap-3 rounded-md border px-4 py-3 text-sm",
  {
    variants: {
      tone: {
        info: "border-border bg-muted text-foreground",
        success: "border-success/30 bg-success-tint text-success-text",
        warning: "border-warning/30 bg-warning-tint text-warning-text",
        danger: "border-danger/30 bg-danger-tint text-danger-text",
      },
    },
    defaultVariants: {
      tone: "info",
    },
  },
);

const ICONE = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

export type AlertProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants>;

export function Alert({
  className,
  tone,
  role,
  children,
  ...props
}: AlertProps) {
  const tomAtual = tone ?? "info";
  const papel =
    role ?? (tomAtual === "danger" || tomAtual === "warning" ? "alert" : "status");
  const Icone = ICONE[tomAtual];

  return (
    <div
      role={papel}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {/*
        aria-hidden porque o ícone repete o que o texto já diz — anunciá-lo
        faria o leitor de tela ler "imagem, aviso" antes de cada mensagem.
        Ele existe para quem VÊ a tela; para quem ouve, o `role` já resolve.
      */}
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
