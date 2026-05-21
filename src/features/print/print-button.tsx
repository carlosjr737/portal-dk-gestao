"use client";

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
        "no-print inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90"
      }
    >
      {label}
    </button>
  );
}
