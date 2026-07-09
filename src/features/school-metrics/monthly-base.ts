import { createAdminClient } from "@/lib/supabase/admin";

export type MonthlyBasePoint = {
  month: string; // "YYYY-MM"
  label: string; // "fev/26"
  enrollments: number;
  students: number;
};

type EnrollmentRow = {
  student_id: string | null;
  start_date: string | null;
  cancelled_at: string | null;
};

const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

// Ano/mês de início da operação no sistema (primeira matrícula = fev/2026).
const START_YEAR = 2026;
const START_MONTH_INDEX = 1; // fevereiro

function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Base ativa por mês reconstruída das matrículas: para cada fim de mês,
 * conta as matrículas que já tinham começado e ainda não haviam sido
 * canceladas. Reflete o roster REAL do sistema (não o churn da planilha).
 */
export async function getMonthlyActiveBase(): Promise<MonthlyBasePoint[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("enrollments")
      .select("student_id, start_date, cancelled_at");

    if (error) {
      console.error("Monthly active base load error:", error.message);
      return [];
    }

    const rows = (data ?? []) as EnrollmentRow[];
    const now = new Date();
    const points: MonthlyBasePoint[] = [];

    let year = START_YEAR;
    let monthIndex = START_MONTH_INDEX;

    while (
      year < now.getFullYear() ||
      (year === now.getFullYear() && monthIndex <= now.getMonth())
    ) {
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      const monthEnd = isoDate(year, monthIndex, lastDay);

      let enrollments = 0;
      const students = new Set<string>();

      for (const row of rows) {
        if (!row.start_date) {
          continue;
        }
        const start = row.start_date.slice(0, 10);
        if (start > monthEnd) {
          continue; // ainda não tinha começado
        }
        const cancel = row.cancelled_at ? row.cancelled_at.slice(0, 10) : null;
        if (cancel && cancel <= monthEnd) {
          continue; // já havia saído até o fim do mês
        }
        enrollments += 1;
        if (row.student_id) {
          students.add(row.student_id);
        }
      }

      points.push({
        month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        label: `${MONTHS[monthIndex]}/${String(year).slice(2)}`,
        enrollments,
        students: students.size,
      });

      monthIndex += 1;
      if (monthIndex > 11) {
        monthIndex = 0;
        year += 1;
      }
    }

    return points;
  } catch (error) {
    console.error(
      "Monthly active base load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
