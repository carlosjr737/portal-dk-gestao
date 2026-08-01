import { getClassOperationalStatus } from "@/features/classes/formatters";
import type { ClassStatus } from "@/features/classes/schemas";
import { Badge } from "@/components/ui/badge";

type ClassStatusBadgeProps = {
  status: ClassStatus;
  capacity: number | null;
  activeEnrollmentsCount: number;
};

export function ClassStatusBadge({
  status,
  capacity,
  activeEnrollmentsCount,
}: ClassStatusBadgeProps) {
  const operationalStatus = getClassOperationalStatus({
    status,
    capacity,
    activeEnrollmentsCount,
  });

  return <Badge tone={operationalStatus.tone}>{operationalStatus.label}</Badge>;
}
