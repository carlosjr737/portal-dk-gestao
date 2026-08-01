import type { StudentStatus } from "@/features/students/schemas";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const statusLabels: Record<StudentStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  evaluation: "Em avaliação",
};

const statusTones: Record<StudentStatus, NonNullable<BadgeProps["tone"]>> = {
  active: "success",
  inactive: "neutral",
  evaluation: "warning",
};

type StatusBadgeProps = {
  status: StudentStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>;
}
