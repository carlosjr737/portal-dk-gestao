import type { StudentStatus } from "@/features/students/schemas";

export type Student = {
  id: string;
  full_name: string;
  display_name: string | null;
  birth_date: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  status: StudentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
