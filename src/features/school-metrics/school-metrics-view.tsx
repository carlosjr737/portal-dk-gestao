import {
  formatScore,
  getPerformanceLabel,
} from "@/features/teacher-dna/scoring";
import type {
  SchoolGroupMetric,
  SchoolMetrics,
  SchoolTeacherMetric,
} from "@/features/school-metrics/queries";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

export function SchoolMetricsView({ metrics }: { metrics: SchoolMetrics }) {
  if (!metrics.available) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Não foi possível carregar as métricas da escola agora. Tente novamente em
        instantes.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <MetricCard label="Alunos ativos" value={String(metrics.activeStudents)} />
        <MetricCard
          label="Matrículas ativas"
          value={String(metrics.activeEnrollments)}
        />
        <MetricCard label="Turmas ativas" value={String(metrics.activeClasses)} />
        <MetricCard
          label="Professores ativos"
          value={String(metrics.teachersActive)}
        />
        <MetricCard
          label="Receita mensal"
          value={formatCurrency(metrics.monthlyRevenue)}
          detail="MRR das matrículas ativas"
        />
        <MetricCard
          label="Ticket médio/aluno"
          value={
            metrics.averageTicket !== null
              ? formatCurrency(metrics.averageTicket)
              : "-"
          }
        />
        <MetricCard
          label="Ocupação"
          value={formatPercent(metrics.occupancyRate)}
          detail={
            metrics.totalCapacity > 0
              ? `${metrics.activeEnrollments}/${metrics.totalCapacity} vagas`
              : "Sem capacidade definida"
          }
        />
        <MetricCard
          label="Nota DNA média"
          value={formatScore(metrics.dnaTeamAverage)}
          detail={`${getPerformanceLabel(metrics.dnaTeamAverage)} · este mês`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GroupTable
          title="Receita por modalidade"
          firstColumn="Modalidade"
          rows={metrics.perModality}
          totalRevenue={metrics.monthlyRevenue}
          totalEnrollments={metrics.activeEnrollments}
        />
        <GroupTable
          title="Receita por nível"
          firstColumn="Nível"
          rows={metrics.perLevel}
          totalRevenue={metrics.monthlyRevenue}
          totalEnrollments={metrics.activeEnrollments}
        />
      </div>

      <TeacherTable
        rows={metrics.perTeacher}
        totalRevenue={metrics.monthlyRevenue}
        totalEnrollments={metrics.activeEnrollments}
      />
    </div>
  );
}

function GroupTable({
  title,
  firstColumn,
  rows,
  totalRevenue,
  totalEnrollments,
}: {
  title: string;
  firstColumn: string;
  rows: SchoolGroupMetric[];
  totalRevenue: number;
  totalEnrollments: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[460px] w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{firstColumn}</th>
              <th className="px-4 py-3">Turmas</th>
              <th className="px-4 py-3">Matrículas</th>
              <th className="px-4 py-3">Receita mensal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.id ?? "__none__"}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.classesCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.activeEnrollments}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatCurrency(row.monthlyRevenue)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-4 py-6 text-center text-muted-foreground"
                  colSpan={4}
                >
                  Sem dados.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
            <tr>
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3">{totalEnrollments}</td>
              <td className="px-4 py-3">{formatCurrency(totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TeacherTable({
  rows,
  totalRevenue,
  totalEnrollments,
}: {
  rows: SchoolTeacherMetric[];
  totalRevenue: number;
  totalEnrollments: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Receita por professor
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ordenado por receita mensal, com a nota de DNA do mês.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[620px] w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Professor</th>
              <th className="px-4 py-3">Turmas</th>
              <th className="px-4 py-3">Matrículas</th>
              <th className="px-4 py-3">Nota DNA</th>
              <th className="px-4 py-3">Receita mensal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.id ?? "__none__"}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.classesCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.activeEnrollments}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatScore(row.dnaScore)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatCurrency(row.monthlyRevenue)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-4 py-6 text-center text-muted-foreground"
                  colSpan={5}
                >
                  Sem turmas vinculadas a professores.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
            <tr>
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3">{totalEnrollments}</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3">{formatCurrency(totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
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
