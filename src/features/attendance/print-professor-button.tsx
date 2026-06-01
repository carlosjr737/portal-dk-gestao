"use client";

import Link from "next/link";

type PrintProfessorButtonProps = {
  href: string;
  hasTeacher: boolean;
};

export function PrintProfessorButton({
  href,
  hasTeacher,
}: PrintProfessorButtonProps) {
  if (hasTeacher) {
    return (
      <Link
        href={href}
        className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90"
      >
        Imprimir chamadas do professor
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.alert("Selecione um professor para imprimir as chamadas.")}
      className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90"
    >
      Imprimir chamadas do professor
    </button>
  );
}
