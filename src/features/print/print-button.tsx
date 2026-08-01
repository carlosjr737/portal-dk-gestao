"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrintButtonProps = {
  label?: string;
  className?: string;
};

export function PrintButton({
  label = "Imprimir",
  className,
}: PrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        cn(buttonVariants({ variant: "secondary" }), "no-print")
      }
    >
      {label}
    </button>
  );
}
