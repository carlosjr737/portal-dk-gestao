"use client";

import { useState } from "react";

type OpenInPinaButtonProps = {
  espetaculoId: string;
  coreografiaId?: string;
  pinaUrl: string;
  label?: string;
  className?: string;
};

/**
 * Pega um custom token do Firebase (via /api/pina/sso-token) e abre o Pina
 * em nova aba com ?token=&espetaculoId=&coreografiaId=.
 */
export function OpenInPinaButton({
  espetaculoId,
  coreografiaId,
  pinaUrl,
  label = "Abrir no Pina",
  className,
}: OpenInPinaButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pina/sso-token", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          body?.error === "firebase_not_configured"
            ? "Integração do Pina ainda não configurada."
            : "Não foi possível abrir o Pina.",
        );
        return;
      }
      const { token } = (await res.json()) as { token: string };
      const url = new URL(pinaUrl);
      url.searchParams.set("token", token);
      url.searchParams.set("espetaculoId", espetaculoId);
      if (coreografiaId) {
        url.searchParams.set("coreografiaId", coreografiaId);
      }
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch {
      setError("Não foi possível abrir o Pina.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className={
          className ??
          "inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {loading ? "Abrindo…" : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
