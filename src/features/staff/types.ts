import type { StaffRole, StaffStatus } from "@/features/staff/schemas";

export type StaffMember = {
  id: string;
  full_name: string;
  artistic_name: string | null;
  email: string | null;
  phone: string | null;
  photo_path: string | null;
  role: StaffRole;
  status: StaffStatus;
  created_at: string;
  updated_at: string;
};

export type TeacherOption = Pick<
  StaffMember,
  "id" | "full_name" | "artistic_name"
>;
