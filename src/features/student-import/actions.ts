"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeClassSchedule,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  parseExcelDate,
} from "@/features/student-import/normalization";
import type {
  StudentImportReportRow,
  StudentImportRow,
  StudentImportState,
  StudentImportSummary,
} from "@/features/student-import/types";

type ExistingStudent = {
  id: string;
  full_name: string;
  display_name: string | null;
  birth_date: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
};

type ExistingGuardian = {
  id: string;
  full_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
};

type ExistingClass = {
  id: string;
  name: string;
  modality_id: string | null;
  teacher_id: string | null;
};

type ExistingSchedule = {
  class_id: string;
  weekday: string;
  start_time: string;
};

type ExistingStaff = {
  id: string;
  full_name: string;
  artistic_name: string | null;
};

type ExistingModality = {
  id: string;
  name: string;
};

type ImportDefaults = {
  startDate: string;
  endDate: string;
  monthlyAmount: number | null;
  status: string;
};

const emptySummary: StudentImportSummary = {
  totalRows: 0,
  newStudents: 0,
  existingStudents: 0,
  newGuardians: 0,
  existingGuardians: 0,
  newLinks: 0,
  newEnrollments: 0,
  existingEnrollments: 0,
  studentsWithoutFinancialGuardian: 0,
  classesNotFound: 0,
  ambiguousClasses: 0,
  cpfConflicts: 0,
  errors: 0,
};

export async function importStudentsAction(
  previousState: StudentImportState,
  formData: FormData,
): Promise<StudentImportState> {
  const intent = String(formData.get("intent") ?? "analyze");
  const defaults = getDefaults(formData);

  if (!defaults.startDate || !defaults.endDate) {
    return {
      status: "error",
      message: "Informe a data de início e a data final padrão.",
      rows: previousState.rows,
      summary: previousState.summary,
      reportRows: previousState.reportRows,
      defaults,
    };
  }

  if (defaults.endDate < defaults.startDate) {
    return {
      status: "error",
      message: "A data final padrão deve ser maior ou igual à data de início.",
      rows: previousState.rows,
      summary: previousState.summary,
      reportRows: previousState.reportRows,
      defaults,
    };
  }

  if (intent === "confirm") {
    if (!previousState.rows?.length) {
      return {
        status: "error",
      message: "Analise uma planilha antes de confirmar a importação.",
      defaults,
      };
    }

    return executeImport(previousState.rows, defaults);
  }

  const file = formData.get("spreadsheet");

  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Selecione uma planilha .xls, .xlsx ou .csv.",
    };
  }

  try {
    const rows = await parseSpreadsheet(file);
    const analysis = await analyzeRows(rows, defaults, false);

    return {
      status: "analyzed",
      message: "Planilha analisada. Revise o relatório antes de confirmar.",
      rows,
      summary: analysis.summary,
      reportRows: analysis.reportRows,
      defaults,
    };
  } catch (error) {
    console.error("Student import parse error:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível ler a planilha.",
      defaults,
    };
  }
}

function getDefaults(formData: FormData): ImportDefaults {
  const monthlyAmountText = String(formData.get("monthly_amount") ?? "").trim();

  return {
    startDate: String(formData.get("start_date") ?? ""),
    endDate: String(formData.get("end_date") ?? ""),
    monthlyAmount: monthlyAmountText ? Number(monthlyAmountText) : null,
    status: String(formData.get("status") ?? "active") || "active",
  };
}

async function parseSpreadsheet(file: File): Promise<StudentImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: true,
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("A planilha não possui abas.");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: true,
  });

  if (matrix.length < 2) {
    throw new Error("A planilha não possui linhas para importação.");
  }

  const header = (matrix[0] ?? []).map((value) => normalizeText(value));
  const dataRows = matrix.slice(1);

  return dataRows
    .map((row, index) => mapSpreadsheetRow(row, header, index + 2))
    .filter((row) => row.studentName || row.classText || row.courseText);
}

function mapSpreadsheetRow(
  row: unknown[],
  header: string[],
  rowNumber: number,
): StudentImportRow {
  const get = (aliases: string[], fallbackIndex: number) => {
    const normalizedAliases = aliases.map(normalizeText);
    const index = header.findIndex((cell) => normalizedAliases.includes(cell));

    return row[index >= 0 ? index : fallbackIndex];
  };
  const duplicateIndex = (label: string, occurrence: number, fallback: number) => {
    const normalizedLabel = normalizeText(label);
    const matches = header
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell === normalizedLabel);

    return row[matches[occurrence]?.index ?? fallback];
  };

  const studentEmail = get(["E-mail do aluno", "Email do aluno"], -1) ?? duplicateIndex("E-mail", 0, 8);
  const guardianEmail =
    get(["E-mail do responsável financeiro", "Email do responsável financeiro"], -1) ??
    duplicateIndex("E-mail", 1, 12);
  const studentPhone =
    get(["Celular do aluno", "Telefone do aluno"], -1) ??
    duplicateIndex("Celular", 0, 10);
  const guardianPhone =
    get(["Celular do responsável financeiro", "Telefone do responsável financeiro"], -1) ??
    duplicateIndex("Celular", 1, 13);
  const studentCpf = get(["CPF do aluno"], -1) ?? duplicateIndex("CPF", 0, 11);
  const guardianCpf =
    get(["CPF do responsável financeiro"], -1) ?? duplicateIndex("CPF", 1, 14);

  return {
    rowNumber,
    classText: String(get(["Turma"], 0) ?? "").trim(),
    courseText: String(get(["Curso"], 1) ?? "").trim(),
    teacherText: String(get(["Professor"], 2) ?? "").trim(),
    capacityText: String(get(["Quantidade Máxima", "Quantidade Maxima"], 3) ?? "").trim(),
    situationText: String(get(["Situação", "Situacao"], 4) ?? "").trim(),
    studentName: String(get(["Nome Aluno", "Aluno", "Nome do aluno"], 5) ?? "").trim(),
    studentNickname: String(get(["Apelido"], 6) ?? "").trim(),
    studentEmail: normalizeEmail(studentEmail),
    studentBirthDate: parseExcelDate(get(["Data de Nascimento", "Nascimento"], 9)),
    studentPhone: normalizePhone(studentPhone),
    studentCpf: normalizeCpf(studentCpf),
    guardianName: String(get(["Responsável Financeiro", "Responsavel Financeiro"], 12) ?? "").trim(),
    guardianEmail: normalizeEmail(guardianEmail),
    guardianPhone: normalizePhone(guardianPhone),
    guardianCpf: normalizeCpf(guardianCpf),
    relationship: String(get(["Parentesco"], 15) ?? "").trim(),
  };
}

async function executeImport(
  rows: StudentImportRow[],
  defaults: ImportDefaults,
): Promise<StudentImportState> {
  const analysis = await analyzeRows(rows, defaults, true);

  revalidatePath("/alunos");
  revalidatePath("/responsaveis");
  revalidatePath("/matriculas");
  revalidatePath("/turmas");
  revalidatePath("/dashboard");

  return {
    status: "imported",
    message: "Importação concluída.",
    rows,
    summary: analysis.summary,
    reportRows: analysis.reportRows,
    defaults,
  };
}

async function analyzeRows(
  rows: StudentImportRow[],
  defaults: ImportDefaults,
  shouldWrite: boolean,
) {
  const supabase = await createClient();
  const [
    studentsResult,
    guardiansResult,
    linksResult,
    classesResult,
    schedulesResult,
    staffResult,
    modalitiesResult,
    enrollmentsResult,
  ] = await Promise.all([
    supabase.from("students").select("id, full_name, display_name, birth_date, document, phone, email"),
    supabase.from("guardians").select("id, full_name, document, phone, email"),
    supabase.from("student_guardians").select("id, student_id, guardian_id"),
    supabase.from("classes").select("id, name, modality_id, teacher_id"),
    supabase.from("class_schedules").select("class_id, weekday, start_time"),
    supabase
      .from("staff_members")
      .select("id, full_name, artistic_name")
      .eq("role", "professor"),
    supabase.from("modalities").select("id, name"),
    supabase.from("enrollments").select("id, student_id, class_id, status").eq("status", "active"),
  ]);

  const loadError =
    studentsResult.error ??
    guardiansResult.error ??
    linksResult.error ??
    classesResult.error ??
    schedulesResult.error ??
    staffResult.error ??
    modalitiesResult.error ??
    enrollmentsResult.error;

  if (loadError) {
    console.error("Student import load error:", loadError);
    throw new Error(`Não foi possível carregar dados existentes: ${loadError.message}`);
  }

  const context = {
    students: (studentsResult.data ?? []) as ExistingStudent[],
    guardians: (guardiansResult.data ?? []) as ExistingGuardian[],
    links: (linksResult.data ?? []) as Array<{ id: string; student_id: string; guardian_id: string }>,
    classes: (classesResult.data ?? []) as ExistingClass[],
    schedules: (schedulesResult.data ?? []) as ExistingSchedule[],
    staff: (staffResult.data ?? []) as ExistingStaff[],
    modalities: (modalitiesResult.data ?? []) as ExistingModality[],
    enrollments: (enrollmentsResult.data ?? []) as Array<{
      id: string;
      student_id: string;
      class_id: string;
      status: string;
    }>,
  };

  const summary = { ...emptySummary, totalRows: rows.length };
  const reportRows: StudentImportReportRow[] = [];
  const cpfConflicts = findCpfConflicts(rows);
  const simulatedStudentKeys = new Set<string>();
  const simulatedStudentIds = new Map<string, string>();
  const simulatedGuardianKeys = new Set<string>();
  const simulatedGuardianIds = new Map<string, string>();
  const simulatedLinks = new Set(context.links.map((link) => `${link.student_id}:${link.guardian_id}`));
  const simulatedEnrollments = new Set(
    context.enrollments.map((enrollment) => `${enrollment.student_id}:${enrollment.class_id}`),
  );

  for (const row of rows) {
    const report: StudentImportReportRow = {
      rowNumber: row.rowNumber,
      studentName: row.studentName,
      classText: row.classText,
      action: shouldWrite ? "importado" : "dry-run",
      warnings: [],
      errors: [],
    };

    if (!row.studentName) {
      report.errors.push("Aluno sem nome.");
    }

    if (row.studentCpf && cpfConflicts.has(row.studentCpf)) {
      summary.cpfConflicts += 1;
      report.warnings.push("CPF do aluno em conflito com nomes diferentes na planilha.");
    }

    const studentMatch = findStudent(row, context.students, cpfConflicts);
    let studentId = studentMatch?.id ?? null;

    if (studentId) {
      summary.existingStudents += 1;
    } else if (!report.errors.length) {
      const studentKey = getStudentKey(row, cpfConflicts);

      if (!simulatedStudentKeys.has(studentKey)) {
        summary.newStudents += 1;
        simulatedStudentKeys.add(studentKey);
      }

      if (shouldWrite) {
        const { data, error } = await supabase
          .from("students")
          .insert({
            full_name: row.studentName,
            display_name: row.studentNickname || null,
            birth_date: row.studentBirthDate,
            document: row.studentCpf || null,
            phone: row.studentPhone || null,
            email: row.studentEmail || null,
            status: "active",
          })
          .select("id, full_name, display_name, birth_date, document, phone, email")
          .single();

        if (error || !data) {
          report.errors.push(`Erro ao criar aluno: ${error?.message ?? "sem retorno"}`);
        } else {
          const created = data as ExistingStudent;
          context.students.push(created);
          studentId = created.id;
        }
      } else {
        const virtualStudentId =
          simulatedStudentIds.get(studentKey) ?? `new-student:${studentKey}`;
        simulatedStudentIds.set(studentKey, virtualStudentId);
        studentId = virtualStudentId;
      }
    }

    let guardianId: string | null = null;

    if (!row.guardianName) {
      summary.studentsWithoutFinancialGuardian += 1;
      report.warnings.push("Aluno sem responsável financeiro.");
    } else {
      const guardianMatch = findGuardian(row, context.guardians);
      guardianId = guardianMatch?.id ?? null;

      if (guardianId) {
        summary.existingGuardians += 1;
      } else {
        const guardianKey = getGuardianKey(row);

        if (!simulatedGuardianKeys.has(guardianKey)) {
          summary.newGuardians += 1;
          simulatedGuardianKeys.add(guardianKey);
        }

        if (shouldWrite) {
          const { data, error } = await supabase
            .from("guardians")
            .insert({
              full_name: row.guardianName,
              document: row.guardianCpf || null,
              phone: row.guardianPhone || null,
              email: row.guardianEmail || null,
            })
            .select("id, full_name, document, phone, email")
            .single();

          if (error || !data) {
            report.errors.push(`Erro ao criar responsável: ${error?.message ?? "sem retorno"}`);
          } else {
            const created = data as ExistingGuardian;
            context.guardians.push(created);
            guardianId = created.id;
          }
        } else {
          const virtualGuardianId =
            simulatedGuardianIds.get(guardianKey) ??
            `new-guardian:${guardianKey}`;
          simulatedGuardianIds.set(guardianKey, virtualGuardianId);
          guardianId = virtualGuardianId;
        }
      }

      if (studentId && guardianId) {
        const linkKey = `${studentId}:${guardianId}`;

        if (!simulatedLinks.has(linkKey)) {
          summary.newLinks += 1;
          simulatedLinks.add(linkKey);

          if (shouldWrite) {
            const { error } = await supabase.from("student_guardians").insert({
              student_id: studentId,
              guardian_id: guardianId,
              relationship: row.relationship || null,
              is_financial_responsible: true,
              is_primary_contact: true,
            });

            if (error) {
              report.errors.push(`Erro ao vincular responsável: ${error.message}`);
            }
          }
        } else if (shouldWrite) {
          await supabase
            .from("student_guardians")
            .update({
              relationship: row.relationship || null,
              is_financial_responsible: true,
              is_primary_contact: true,
            })
            .eq("student_id", studentId)
            .eq("guardian_id", guardianId);
        }
      }
    }

    const classMatches = findClassMatches(row, context);
    let classId: string | null = null;

    if (classMatches.length === 0) {
      summary.classesNotFound += 1;
      report.errors.push("Turma não encontrada.");
    } else if (classMatches.length > 1) {
      summary.ambiguousClasses += 1;
      report.errors.push("Turma ambígua.");
    } else {
      classId = classMatches[0].id;
    }

    if (studentId && classId) {
      const enrollmentKey = `${studentId}:${classId}`;

      if (simulatedEnrollments.has(enrollmentKey)) {
        summary.existingEnrollments += 1;
        report.warnings.push("Matrícula ativa já existente para este aluno nesta turma.");
      } else {
        summary.newEnrollments += 1;
        simulatedEnrollments.add(enrollmentKey);

        if (shouldWrite) {
          const { error } = await supabase.from("enrollments").insert({
            student_id: studentId,
            class_id: classId,
            status: defaults.status,
            start_date: defaults.startDate,
            end_date: defaults.endDate,
            monthly_amount: defaults.monthlyAmount,
            financial_guardian_id: guardianId,
          });

          if (error) {
            report.errors.push(`Erro ao criar matrícula: ${error.message}`);
          }
        }
      }
    }

    if (report.errors.length > 0) {
      summary.errors += 1;
    }

    reportRows.push(report);
  }

  return { summary, reportRows };
}

function findCpfConflicts(rows: StudentImportRow[]) {
  const namesByCpf = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.studentCpf) {
      continue;
    }

    const names = namesByCpf.get(row.studentCpf) ?? new Set<string>();
    names.add(normalizeText(row.studentName));
    namesByCpf.set(row.studentCpf, names);
  }

  return new Set(
    Array.from(namesByCpf.entries())
      .filter(([, names]) => names.size > 1)
      .map(([cpf]) => cpf),
  );
}

function getStudentKey(row: StudentImportRow, cpfConflicts: Set<string>) {
  if (row.studentCpf && !cpfConflicts.has(row.studentCpf)) {
    return `cpf:${row.studentCpf}`;
  }

  return `name_birth:${normalizeText(row.studentName)}:${row.studentBirthDate ?? ""}`;
}

function getGuardianKey(row: StudentImportRow) {
  return (
    row.guardianCpf ||
    row.guardianEmail ||
    row.guardianPhone ||
    normalizeText(row.guardianName)
  );
}

function findStudent(
  row: StudentImportRow,
  students: ExistingStudent[],
  cpfConflicts: Set<string>,
) {
  if (row.studentCpf && !cpfConflicts.has(row.studentCpf)) {
    const byCpf = students.find(
      (student) => normalizeCpf(student.document) === row.studentCpf,
    );

    if (byCpf) {
      return byCpf;
    }
  }

  return students.find(
    (student) =>
      normalizeText(student.full_name) === normalizeText(row.studentName) &&
      ((student.birth_date ?? null) === row.studentBirthDate ||
        (!student.birth_date && !row.studentBirthDate)),
  );
}

function findGuardian(row: StudentImportRow, guardians: ExistingGuardian[]) {
  return guardians.find((guardian) => {
    if (row.guardianCpf && normalizeCpf(guardian.document) === row.guardianCpf) {
      return true;
    }

    if (row.guardianEmail && normalizeEmail(guardian.email) === row.guardianEmail) {
      return true;
    }

    if (row.guardianPhone && normalizePhone(guardian.phone) === row.guardianPhone) {
      return true;
    }

    return normalizeText(guardian.full_name) === normalizeText(row.guardianName);
  });
}

function findClassMatches(
  row: StudentImportRow,
  context: {
    classes: ExistingClass[];
    schedules: ExistingSchedule[];
    staff: ExistingStaff[];
    modalities: ExistingModality[];
  },
) {
  const teacherId = findTeacherId(row.teacherText, context.staff);
  const modalityId = findModalityId(row.courseText, context.modalities);
  const schedule = normalizeClassSchedule(row.classText);

  if (!teacherId || !modalityId || !schedule.startTime || schedule.weekdays.length === 0) {
    return [];
  }

  return context.classes.filter((danceClass) => {
    if (danceClass.teacher_id !== teacherId || danceClass.modality_id !== modalityId) {
      return false;
    }

    const classSchedules = context.schedules.filter(
      (item) => item.class_id === danceClass.id,
    );
    const matchingSchedules = classSchedules.filter(
      (item) =>
        schedule.weekdays.includes(item.weekday) &&
        item.start_time.slice(0, 5) === schedule.startTime,
    );

    return (
      matchingSchedules.length === schedule.weekdays.length &&
      classSchedules.filter((item) => item.start_time.slice(0, 5) === schedule.startTime)
        .length === schedule.weekdays.length
    );
  });
}

function findTeacherId(value: string, staff: ExistingStaff[]) {
  const normalized = normalizeText(value);

  return (
    staff.find(
      (member) =>
        normalizeText(member.artistic_name) === normalized ||
        normalizeText(member.full_name) === normalized,
    )?.id ?? null
  );
}

function findModalityId(value: string, modalities: ExistingModality[]) {
  const normalized = normalizeText(value)
    .replace(/\bDANCE\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const aliases: Record<string, string> = {
    "DANCAS URBANAS": "DANCAS URBANAS",
    URBANAS: "DANCAS URBANAS",
    DU: "DANCAS URBANAS",
    JAZZ: "JAZZ",
    "JAZZ DANCE": "JAZZ",
    KPOP: "K POP",
    "K-POP": "K POP",
    "K POP": "K POP",
  };
  const target = aliases[normalized] ?? normalized;

  return (
    modalities.find((modality) => {
      const modalityName = normalizeText(modality.name)
        .replace("-", " ")
        .replace(/\s+/g, " ")
        .trim();

      return (aliases[modalityName] ?? modalityName) === target;
    })?.id ?? null
  );
}
