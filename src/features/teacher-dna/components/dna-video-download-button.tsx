"use client";

import { useState } from "react";

// URL pública do backend de análise (Railway). Assina um link temporário do
// vídeo no GCS. É público (só uma URL), por isso pode ficar hardcoded com
// override por env.
const ANALYSIS_API_URL =
  process.env.NEXT_PUBLIC_ANALYSIS_API_URL ||
  "https://aulaabertafixed-production.up.railway.app";

export function DnaVideoDownloadButton({
  videoGcsFile,
  className,
}: {
  videoGcsFile: string | null;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!videoGcsFile) {
    return null;
  }

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${ANALYSIS_API_URL}/video-signed-url?file=${encodeURIComponent(
          videoGcsFile as string,
        )}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Falha ao gerar link do vídeo");
      }
      const anchor = document.createElement("a");
      anchor.href = data.url;
      anchor.rel = "noopener";
      anchor.target = "_blank";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao baixar vídeo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      title={error ?? "Baixar vídeo da aula"}
      aria-label="Baixar vídeo da aula"
      className={
        className ??
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {loading ? (
        <span className="text-[10px] font-semibold">...</span>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v10" />
          <path d="m8 11 4 4 4-4" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      )}
    </button>
  );
}
