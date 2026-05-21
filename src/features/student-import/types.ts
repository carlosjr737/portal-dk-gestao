export type ImportStatus = "ready" | "analyzed" | "imported" | "error";

export type StudentImportRow = {
  rowNumber: number;
  classText: string;
  courseText: string;
  teacherText: string;
  capacityText: string;
  situationText: string;
  studentName: string;
  studentNickname: string;
  studentEmail: string;
  studentBirthDate: string | null;
  studentPhone: string;
  studentCpf: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianCpf: string;
  relationship: string;
};

export type StudentImportSummary = {
  totalRows: number;
  newStudents: number;
  existingStudents: number;
  newGuardians: number;
  existingGuardians: number;
  newLinks: number;
  newEnrollments: number;
  existingEnrollments: number;
  studentsWithoutFinancialGuardian: number;
  classesNotFound: number;
  ambiguousClasses: number;
  cpfConflicts: number;
  errors: number;
};

export type StudentImportReportRow = {
  rowNumber: number;
  studentName: string;
  classText: string;
  action: string;
  warnings: string[];
  errors: string[];
};

export type StudentImportState = {
  status: ImportStatus;
  message?: string;
  rows?: StudentImportRow[];
  summary?: StudentImportSummary;
  reportRows?: StudentImportReportRow[];
  defaults?: {
    startDate: string;
    endDate: string;
    monthlyAmount: number | null;
    status: string;
  };
};
