import Link from "next/link";
import { AttendanceSheet } from "@/features/attendance/attendance-sheet";
import {
  getAllAttendanceClassSheets,
  getAttendanceClasses,
  getAttendanceClassSheet,
  getProfessorAttendanceClassSheets,
  normalizeAttendanceMonth,
  type AttendanceFilters,
  weekdayOptions,
} from "@/features/attendance/data";
import { PrintButton } from "@/features/print/print-button";

export const dynamic = "force-dynamic";

type ImprimirTodasPageProps = {
  searchParams?: Promise<{
    teacherId?: string;
    modalityId?: string;
    levelId?: string;
    weekday?: string;
    status?: string;
    classId?: string;
    month?: string;
  }>;
};

export default async function ImprimirTodasPage({
  searchParams,
}: ImprimirTodasPageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const sheets = await getSheetsForPrint(filters);

  return (
    <div className="bg-white">
      <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/chamada"
          className="text-sm font-medium text-primary hover:underline"
        >
          Voltar para chamada
        </Link>
        <PrintButton
          label={
            filters.teacherId
              ? "Imprimir chamadas do professor"
              : "Imprimir todas"
          }
        />
      </div>

      <div className="space-y-10 print:space-y-0">
        {sheets.length > 0 ? (
          sheets.map((sheet) => <AttendanceSheet key={sheet.id} sheet={sheet} />)
        ) : (
          <div className="rounded-md border border-border bg-white px-4 py-10 text-center text-sm text-muted-foreground">
            {filters.teacherId
              ? "Este professor não possui turmas cadastradas."
              : "Nenhuma turma ativa encontrada para impressão."}
          </div>
        )}
      </div>
    </div>
  );
}

async function getSheetsForPrint(filters: AttendanceFilters) {
  if (filters.teacherId) {
    return getProfessorAttendanceClassSheets({
      teacherId: filters.teacherId,
      month: filters.month,
    });
  }

  if (hasFilters(filters)) {
    return getFilteredSheets(filters);
  }

  return getAllAttendanceClassSheets(filters.month);
}

async function getFilteredSheets(filters: AttendanceFilters) {
  const classes = await getAttendanceClasses(filters);
  const sheets = await Promise.all(
    classes.map((danceClass) => getAttendanceClassSheet(danceClass.id, filters.month)),
  );

  return sheets.filter((sheet): sheet is NonNullable<typeof sheet> =>
    Boolean(sheet),
  );
}

function parseFilters(params?: {
  teacherId?: string;
  modalityId?: string;
  levelId?: string;
  weekday?: string;
  status?: string;
  classId?: string;
  month?: string;
}): AttendanceFilters {
  return {
    classId: params?.classId || undefined,
    teacherId: params?.teacherId || undefined,
    modalityId: params?.modalityId || undefined,
    levelId: params?.levelId || undefined,
    weekday: weekdayOptions.some((option) => option.value === params?.weekday)
      ? (params?.weekday as AttendanceFilters["weekday"])
      : undefined,
    status: params?.status === "planning" ? "planning" : "active",
    month: normalizeAttendanceMonth(params?.month),
  };
}

function hasFilters(filters: AttendanceFilters) {
  return Boolean(
    filters.teacherId ||
      filters.classId ||
      filters.modalityId ||
      filters.levelId ||
      filters.weekday ||
      filters.status !== "active",
  );
}
