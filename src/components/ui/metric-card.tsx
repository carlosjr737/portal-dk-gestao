import type { ReactNode } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Cartão de indicador.
 *
 * Um número sozinho não gera insight, gera consulta. Por isso `hint` e `href`
 * não são enfeite: o cartão só cumpre a identidade quando responde
 * "comparado com quê" (delta), "isso é bom ou ruim" (hint) e "e agora"
 * (href). Ver docs/identidade-visual.md.
 *
 * O portal tem outras oito cópias locais de MetricCard, cada uma com sua
 * casca. Esta é a canônica; as demais migram quando a tela delas for mexida.
 */

export type MetricCardDelta = {
  value: number;
  /** `percent` imprime "%"; `absolute` imprime o número cru (+12, −8). */
  kind: "percent" | "absolute";
  /** Contra o quê a variação é medida, ex.: "vs. mês anterior". */
  hint?: string;
};

export type MetricCardProps = {
  label: string;
  value: string;
  /** Linha de apoio: o derivado que dá sentido ao número principal. */
  hint?: ReactNode;
  /** Para onde a pessoa vai para agir sobre este número. */
  href?: string;
  delta?: MetricCardDelta;
  /** Medidor, barra ou qualquer reforço visual sob a linha de apoio. */
  children?: ReactNode;
  className?: string;
};

export function MetricCard({
  label,
  value,
  hint,
  href,
  delta,
  children,
  className,
}: MetricCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[12.5px] font-medium text-muted-foreground">
          {label}
        </span>
        {delta ? <DeltaChip {...delta} /> : null}
      </div>

      <p className="mt-3 text-[28px] font-bold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>

      {hint ? (
        <p className="mt-1.5 text-[12px] leading-4 text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {children}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "block rounded-xl border border-border bg-card p-5 text-card-foreground transition-colors hover:border-input",
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return <Card className={cn("p-5", className)}>{content}</Card>;
}

function DeltaChip({ value, kind, hint }: MetricCardDelta) {
  const formatted =
    kind === "percent"
      ? `${Math.abs(value).toFixed(1).replace(".", ",")}%`
      : String(Math.abs(value));

  if (value === 0) {
    return (
      <span
        className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-muted-foreground"
        title={hint}
      >
        {kind === "percent" ? "0,0%" : "0"}
      </span>
    );
  }

  const subiu = value > 0;
  const Icon = subiu ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums",
        subiu
          ? "bg-success-tint text-success-text"
          : "bg-danger-tint text-danger-text",
      )}
      title={hint}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {/* O sinal fica no texto, não só na cor e no ícone. */}
      {subiu ? "+" : "−"}
      {formatted}
    </span>
  );
}
