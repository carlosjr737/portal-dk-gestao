import type { MonthlyBasePoint } from "@/features/school-metrics/monthly-base";

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatDelta(value: number) {
  if (value === 0) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)}`;
}

function deltaClass(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-muted-foreground";
}

export function MonthlyBaseView({ points }: { points: MonthlyBasePoint[] }) {
  if (points.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Base ativa por mês
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Matrículas e alunos distintos ativos no fim de cada mês, reconstruído
          a partir das datas de início e cancelamento das matrículas do sistema.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-semibold">Mês</th>
              <th className="px-5 py-3 text-right font-semibold">Matrículas ativas</th>
              <th className="px-5 py-3 text-right font-semibold">Variação</th>
              <th className="px-5 py-3 text-right font-semibold">Alunos ativos</th>
              <th className="px-5 py-3 text-right font-semibold">Variação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {points.map((point, index) => {
              const prev = index > 0 ? points[index - 1] : null;
              const dEnr = prev ? point.enrollments - prev.enrollments : 0;
              const dStu = prev ? point.students - prev.students : 0;
              return (
                <tr key={point.month} className="hover:bg-muted/50">
                  <td className="px-5 py-3 font-medium text-foreground">
                    {point.label}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(point.enrollments)}
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums ${deltaClass(dEnr)}`}>
                    {index === 0 ? "—" : formatDelta(dEnr)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-foreground">
                    {numberFormatter.format(point.students)}
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums ${deltaClass(dStu)}`}>
                    {index === 0 ? "—" : formatDelta(dStu)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Reflete o roster real do sistema (matrículas cadastradas + cancelamentos
        registrados). O churn histórico da planilha não entra aqui — esse fica no
        painel Growth &amp; Churn.
      </p>
    </section>
  );
}
