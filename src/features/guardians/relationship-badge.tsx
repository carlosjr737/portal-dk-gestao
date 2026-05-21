import type { GuardianRelationship } from "@/features/guardians/schemas";

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
    <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
      {relationshipLabels[relationship]}
    </span>
  );
}
