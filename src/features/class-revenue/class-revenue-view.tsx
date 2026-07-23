import type { SchoolClassRevenueMetric } from "@/features/school-metrics/queries";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrencyBRL(value: number) {
  return currencyFormatter.format(value ?? 0);
}

type ClassRevenueViewProps = {
  classes: SchoolClassRevenueMetric[];
};

export function ClassRevenueView({ classes }: ClassRevenueViewProps) {
  const rows = [...classes].sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);

  const totalRevenue = rows.reduce((sum, row) => sum + row.monthlyRevenue, 0);
  const totalDiscount = rows.reduce((sum, row) => sum + row.totalDiscount, 0);
  const totalStudents = rows.reduce((sum, row) => sum + row.activeStudents, 0);
  const averageTicket = totalStudents > 0 ? totalRevenue / totalStudents : 0;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white p-8 text-center text-sm text-muted-foreground">
        Nenhuma turma ativa com faturamento para exibir.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Faturamento mensal"
          value={formatCurrencyBRL(totalRevenue)}
          detail="Mensalidade líquida · turmas ativas"
        />
        <MetricCard label="Turmas ativas" value={String(rows.length)} />
        <MetricCard label="Alunos ativos" value={String(totalStudents)} />
        <MetricCard
          label="Ticket médio por aluno"
          value={formatCurrencyBRL(averageTicket)}
        />
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Faturamento por turma
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mensalidade líquida (já descontados os descontos), ordenado do maior
            para o menor.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Turma</th>
                <th className="px-4 py-3 font-semibold">Professor</th>
                <th className="px-4 py-3 font-semibold">Nível</th>
                <th className="px-4 py-3 font-semibold">Horário</th>
                <th className="px-4 py-3 text-right font-semibold">Alunos</th>
                <th className="px-4 py-3 text-right font-semibold">Desconto</th>
                <th className="px-4 py-3 text-right font-semibold">Ticket médio</th>
                <th className="px-4 py-3 text-right font-semibold">Faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.classId} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.className}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.teacherName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.levelName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.scheduleLabel}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {row.activeStudents}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {row.totalDiscount > 0
                      ? `- ${formatCurrencyBRL(row.totalDiscount)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrencyBRL(row.averageTicketPerEnrollment)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {formatCurrencyBRL(row.monthlyRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-4 py-3 text-foreground" colSpan={4}>
                  Total
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {totalStudents}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {totalDiscount > 0 ? `- ${formatCurrencyBRL(totalDiscount)}` : "—"}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {formatCurrencyBRL(totalRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {detail ? (
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
