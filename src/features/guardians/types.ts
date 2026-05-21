import type { GuardianRelationship } from "@/features/guardians/schemas";
import type { StudentStatus } from "@/features/students/schemas";

export type Guardian = {
  id: string;
  full_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentOption = {
  id: string;
  full_name: string;
  status: StudentStatus;
};

export type LinkedStudent = {
  id: string;
  relationship_type: GuardianRelationship | null;
  is_primary: boolean;
  student: {
    id: string;
    full_name: string;
    status: StudentStatus;
  } | null;
};
