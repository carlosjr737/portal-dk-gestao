import type { GuardianRelationship } from "@/features/guardians/schemas";
import { Badge } from "@/components/ui/badge";

const relationshipLabels: Record<GuardianRelationship, string> = {
  financial: "Financeiro",
  pedagogical: "Pedagógico",
  emergency: "Emergência",
};

type RelationshipBadgeProps = {
  relationship: GuardianRelationship | null;
};

export function RelationshipBadge({ relationship }: RelationshipBadgeProps) {
  if (!relationship) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
        Não definido
      </span>
    );
  }

  return (
    <Badge tone="danger">
      {relationshipLabels[relationship]}
    </Badge>
  );
}
