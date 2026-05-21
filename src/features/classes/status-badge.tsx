import { getClassOperationalStatus } from "@/features/classes/formatters";
import type { ClassStatus } from "@/features/classes/schemas";

const toneClasses = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

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

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[operationalStatus.tone]}`}
    >
      {operationalStatus.label}
    </span>
  );
}
