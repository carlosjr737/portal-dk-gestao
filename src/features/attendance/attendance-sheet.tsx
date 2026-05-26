import type { AttendanceClassSheet } from "@/features/attendance/data";

type AttendanceSheetProps = {
  sheet: AttendanceClassSheet;
};

export function AttendanceSheet({ sheet }: AttendanceSheetProps) {
  return (
    <section className="print-class-page bg-white text-black">
      <header className="attendance-print-header border-b border-black pb-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-lg font-bold">DK Studio</p>
            <h1 className="mt-1 text-2xl font-bold">Lista de chamada</h1>
          </div>
          <div className="text-right text-sm">
            <p>Data de impressão</p>
            <p className="font-semibold">
              {new Intl.DateTimeFormat("pt-BR").format(new Date())}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Info label="Turma" value={sheet.name} />
          <Info label="Professor" value={sheet.teacherName} />
          <Info label="Modalidade" value={sheet.modalityName} />
          <Info label="Nível" value={sheet.levelName} />
          <Info label="Horários" value={sheet.schedulesText} />
          <Info label="Mês/Ano da chamada" value={sheet.monthLabel} />
          <Info
            label="Total de alunos ativos"
            value={String(sheet.activeStudentsCount)}
          />
        </dl>
        <p className="mt-3 text-xs">
          P = Presença | F = Falta
          {(sheet.suspendedAttendanceDates?.length ?? 0) > 0
            ? " | * Aula suspensa por evento/feriado"
            : ""}
        </p>
      </header>

      {sheet.attendanceDates.length === 0 ? (
        <div className="mt-5 border border-black px-3 py-6 text-center text-sm">
          Não há horários cadastrados para gerar os dias da chamada.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="attendance-print-table w-full table-fixed border-collapse text-[11px]">
            <thead>
              <tr className="bg-white">
                <th className="attendance-number-cell w-8 border border-black px-1 py-2 text-left font-bold">
                  Nº
                </th>
                <th className="attendance-student-cell w-56 border border-black px-2 py-2 text-left font-bold">
                  Nome do aluno
                </th>
                {sheet.attendanceDates.map((date) => (
                  <th
                    key={date}
                    className="attendance-date-cell w-10 border border-black px-1 py-2 text-center font-bold"
                  >
                    {date}
                    {sheet.suspendedAttendanceDates?.includes(date) ? "*" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.students.length > 0 ? (
                sheet.students.map((student, index) => (
                  <tr key={student.enrollmentId}>
                    <td className="attendance-number-cell border border-black px-1 py-2">
                      {index + 1}
                    </td>
                    <td className="attendance-student-cell border border-black px-2 py-2">
                      {student.studentName}
                    </td>
                    {sheet.attendanceDates.map((date) => (
                      <td
                        key={`${student.enrollmentId}-${date}`}
                        className="attendance-date-cell border border-black px-1 py-2 text-center"
                      >
                        &nbsp;
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={sheet.attendanceDates.length + 2}
                    className="border border-black px-2 py-6 text-center"
                  >
                    Nenhum aluno ativo nesta turma.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
