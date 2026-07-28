"use client";

import { useEffect, useRef } from "react";

/** Dispara a janela de imprimir/salvar-PDF uma vez, ao abrir a página do contrato. */
export function AutoPrint() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    // Pequeno atraso para garantir que o contrato terminou de renderizar.
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
