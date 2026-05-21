import type { EnrollmentStatus } from "@/features/enrollments/schemas";

export function formatEnrollmentStatus(status: EnrollmentStatus) {
  const labels: Record<EnrollmentStatus, string> = {
    active: "Ativa",
    cancelled: "Cancelada",
    paused: "Pausada",
    ended: "Encerrada",
    evaluation: "Em avaliação",
  };

  return labels[status];
}

export function formatMoney(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Não informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatFinancialGuardianName(name: string | null | undefined) {
  return name?.trim() || "Não informado";
}
