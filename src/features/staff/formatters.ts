import type { StaffMember, TeacherOption } from "@/features/staff/types";

export function getStaffDisplayName(
  staffMember: Pick<StaffMember, "full_name" | "artistic_name"> | TeacherOption,
) {
  return staffMember.artistic_name?.trim() || staffMember.full_name;
}

export function formatStaffRole(role: StaffMember["role"]) {
  const labels: Record<StaffMember["role"], string> = {
    professor: "Professor",
    coordenador: "Coordenador",
    financeiro: "Financeiro",
    secretaria: "Secretaria",
    admin: "Admin",
  };

  return labels[role];
}

export function formatStaffStatus(status: StaffMember["status"]) {
  return status === "active" ? "Ativo" : "Inativo";
}
