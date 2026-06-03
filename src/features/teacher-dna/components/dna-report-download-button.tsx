"use client";

import { useState } from "react";
import { getDnaReportDownloadUrl } from "@/features/teacher-dna/actions";

export function DnaReportDownloadButton({
  reportPath,
  label = "Baixar relatório (PDF)",
  className,
}: {
  reportPath: string | null;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reportPath) {
    return (
      <span className="text-xs text-muted-foreground">
        Relatório indisponível
      </span>
    );
  }

  async function handleDownload() {
    setLoading(true);
    setError(null);

    const result = await getDnaReportDownloadUrl(reportPath as string);

    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = result.url;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className={
          className ??
          "inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {loading ? "Gerando link..." : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
