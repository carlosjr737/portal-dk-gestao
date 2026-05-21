import type { StudentStatus } from "@/features/students/schemas";

const statusLabels: Record<StudentStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  evaluation: "Em avaliação",
};

const statusClasses: Record<StudentStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
  evaluation: "border-amber-200 bg-amber-50 text-amber-700",
};

type StatusBadgeProps = {
  status: StudentStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
