"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Ao concluir a matrícula (página do aluno com ?created=1), tenta abrir o
 * contrato em nova aba já disparando o salvar-PDF. Se o navegador bloquear o
 * popup, mostra um botão de fallback.
 */
export function ContractLauncher({ href }: { href: string }) {
  const tried = useRef(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    const win = window.open(href, "_blank");
    if (!win) {
      setBlocked(true);
    }
  }, [href]);

  return (
    <div className="no-print mt-4 flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-emerald-800">
        ✅ Matrícula criada — contrato pronto.
        {blocked
          ? " O navegador bloqueou a abertura automática."
          : " Abrindo o contrato em nova aba…"}
      </p>
      <Link
        href={href}
        target="_blank"
        className="inline-flex h-9 w-fit items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:opacity-90"
      >
        Abrir contrato
      </Link>
    </div>
  );
}
