import type { EnrollmentStatus } from "@/features/enrollments/schemas";

export type EnrollmentStudentOption = {
  id: string;
  full_name: string;
  status: string;
  phone: string | null;
  email: string | null;
  financialGuardianName: string | null;
  financialGuardianPhone: string | null;
};

export type EnrollmentClassOption = {
  id: string;
  name: string;
  category: string | null;
  level: string | null;
  capacity: number | null;
  teacherName: string | null;
  schedulesLabel: string;
  activeEnrollmentsCount: number;
};

export type EnrollmentGuardianOption = {
  id: string;
  student_id: string;
  guardian_id: string;
  guardian_name: string;
  relationship_type: string | null;
  phone: string | null;
  is_primary: boolean;
  is_financial_responsible: boolean;
};

export type EnrollmentListRow = {
  id: string;
  status: EnrollmentStatus;
  start_date: string | null;
  end_date: string | null;
  first_due_date: string | null;
  monthly_amount: number | null;
  discount_amount: number | null;
  discount_reason: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  financial_guardian_id: string | null;
  student: {
    id: string;
    full_name: string;
  } | null;
  class: {
    id: string;
    name: string;
    teacherName: string | null;
  } | null;
  financialGuardian: {
    id: string;
    full_name: string;
  } | null;
  externalFinancialRecord: {
    status: string;
    provider_protocol_id: string | null;
    provider_receivable_id: string | null;
    provider_contract_id: string | null;
    amount: number | null;
    due_date: string | null;
    error_message: string | null;
  } | null;
  guardianFinancialContract: {
    id: string;
    item_id: string | null;
    status: string;
    provider_contract_id: string | null;
    total_amount: number | null;
    version: number | null;
    error_message: string | null;
  } | null;
};
