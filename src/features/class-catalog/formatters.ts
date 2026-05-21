import type { CatalogStatus } from "@/features/class-catalog/schemas";

export function formatCatalogStatus(status: CatalogStatus) {
  const labels: Record<CatalogStatus, string> = {
    active: "Ativo",
    inactive: "Inativo",
  };

  return labels[status] ?? status;
}
