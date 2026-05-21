import Link from "next/link";
import { AttendanceSheet } from "@/features/attendance/attendance-sheet";
import { getAttendanceClassSheet } from "@/features/attendance/data";
import { PrintButton } from "@/features/print/print-button";

export const dynamic = "force-dynamic";

type ChamadaTurmaPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function ChamadaTurmaPage({
  params,
}: ChamadaTurmaPageProps) {
  const { classId } = await params;
  const sheet = await getAttendanceClassSheet(classId);

  if (!sheet) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Não foi possível encontrar uma turma ativa para gerar a lista de chamada.
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/chamada"
          className="text-sm font-medium text-primary hover:underline"
        >
          Voltar para chamada
        </Link>
        <PrintButton />
      </div>

      <AttendanceSheet sheet={sheet} />
    </div>
  );
}
