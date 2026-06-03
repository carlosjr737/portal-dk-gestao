"use server";

import { createClient } from "@/lib/supabase/server";

const dnaReportsBucket = "dna-reports";

type DnaReportUrlResult = { url: string } | { error: string };

export async function getDnaReportDownloadUrl(
  reportPath: string,
): Promise<DnaReportUrlResult> {
  const path = reportPath?.trim();

  if (!path) {
    return { error: "Relatório indisponível para esta aula." };
  }

  const objectPath = path.replace(/^dna-reports\//, "");
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(dnaReportsBucket)
    .createSignedUrl(objectPath, 60, { download: true });

  if (error || !data?.signedUrl) {
    console.error("[DNA REPORT] signed url error", error?.message);
    return { error: "Não foi possível gerar o link do relatório." };
  }

  return { url: data.signedUrl };
}
