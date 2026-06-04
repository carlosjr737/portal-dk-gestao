import {
  formatScore,
  getPerformanceLabel,
} from "@/features/teacher-dna/scoring";
import type {
  TeacherBusinessMetrics as TeacherBusinessMetricsData,
  TeacherGroupMetric,
} from "@/features/teacher-dna/teacher-metrics";

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

const classStatusLabels: Record<string, string> = {
  active: "Ativa",
  inactive: "Inativa",
  planning: "Planejamento",
};

export function TeacherBusinessMetrics({
  metrics,
  dnaScore,
  modalityNames,
  levelNames,
}: {
  metrics: TeacherBusinessMetricsData;
  dnaScore: number | null;
  modalityNames: Record<string, string>;
  levelNames: Record<string, string>;
}) {
  if (!metrics.available) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Não foi possível carregar as métricas de matrículas e receita deste
        professor agora.
      </section>
    );
  }

  if (metrics.classesCount === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-white px-6 py-8 text-center text-sm text-muted-foreground shadow-sm">
        Este professor ainda não tem turmas vinculadas, então não há matrículas
        nem receita para exibir.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Matrículas e receita
        </h2>
        <p className="text-sm text-muted-foreground">
          Situação atual das turmas do professor (matrículas ativas).
        </p>
      </div>

      <DnaRevenuePanel
        dnaScore={dnaScore}
        monthlyRevenue={metrics.monthlyRevenue}
        occupancyRate={metrics.occupancyRate}
        activeStudents={metrics.activeStudents}
      />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Matrículas ativas" value={String(metrics.activeEnrollments)} />
        <MetricCard label="Turmas" value={String(metrics.classesCount)} />
        <MetricCard label="Alunos ativos" value={String(metrics.activeStudents)} />
        <MetricCard
          label="Receita mensal"
          value={formatCurrency(metrics.monthlyRevenue)}
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
          label="Ocupação média"
          value={formatPercent(metrics.occupancyRate)}
          detail={
            metrics.totalCapacity > 0
              ? `${metrics.activeStudents}/${metrics.totalCapacity} vagas`
              : "Sem capacidade definida"
          }
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Receita por turma
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Alunos</th>
                <th className="px-4 py-3">Ocupação</th>
                <th className="px-4 py-3">Receita mensal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {metrics.perClass.map((row) => (
                <tr key={row.classId}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {classStatusLabels[row.status] ?? row.status}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.activeStudents}
                    {row.capacity ? ` / ${row.capacity}` : ""}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.capacity
                      ? formatPercent(row.activeStudents / row.capacity)
                      : "-"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatCurrency(row.monthlyRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-3">{metrics.activeStudents}</td>
                <td className="px-4 py-3">{formatPercent(metrics.occupancyRate)}</td>
                <td className="px-4 py-3">
                  {formatCurrency(metrics.monthlyRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GroupRevenueTable
          title="Receita por modalidade"
          firstColumn="Modalidade"
          rows={metrics.perModality}
          nameById={modalityNames}
          emptyName="Sem modalidade"
          totalRevenue={metrics.monthlyRevenue}
          totalStudents={metrics.activeStudents}
        />
        <GroupRevenueTable
          title="Receita por nível"
          firstColumn="Nível"
          rows={metrics.perLevel}
          nameById={levelNames}
          emptyName="Sem nível"
          totalRevenue={metrics.monthlyRevenue}
          totalStudents={metrics.activeStudents}
        />
      </div>
    </section>
  );
}

function DnaRevenuePanel({
  dnaScore,
  monthlyRevenue,
  occupancyRate,
  activeStudents,
}: {
  dnaScore: number | null;
  monthlyRevenue: number;
  occupancyRate: number | null;
  activeStudents: number;
}) {
  const insight = buildDnaRevenueInsight(dnaScore, occupancyRate, activeStudents);

  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">
        DNA × receita
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Nota DNA
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">
            {formatScore(dnaScore)}
          </p>
          <p className="text-xs text-muted-foreground">
            {getPerformanceLabel(dnaScore)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Receita mensal
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">
            {formatCurrency(monthlyRevenue)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Ocupação
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">
            {formatPercent(occupancyRate)}
          </p>
        </div>
      </div>
      <p className={`mt-3 rounded-md px-3 py-2 text-sm ${insight.className}`}>
        {insight.text}
      </p>
    </div>
  );
}

function buildDnaRevenueInsight(
  dnaScore: number | null,
  occupancyRate: number | null,
  activeStudents: number,
): { text: string; className: string } {
  const neutral = "bg-muted/50 text-muted-foreground";

  if (dnaScore === null) {
    return {
      text: "Sem avaliação de DNA no período — não dá para cruzar qualidade com receita ainda.",
      className: neutral,
    };
  }

  if (activeStudents === 0 || occupancyRate === null) {
    return {
      text: "Sem matrículas ativas suficientes para relacionar a nota de DNA com ocupação e receita.",
      className: neutral,
    };
  }

  const highQuality = dnaScore >= 80;
  const lowQuality = dnaScore < 70;
  const highOccupancy = occupancyRate >= 0.8;
  const lowOccupancy = occupancyRate < 0.6;

  if (highQuality && lowOccupancy) {
    return {
      text: "Professor bem avaliado, mas com vagas ociosas — boa oportunidade de captação para essas turmas.",
      className: "bg-amber-50 text-amber-800",
    };
  }

  if (lowQuality && highOccupancy) {
    return {
      text: "Turmas cheias com avaliação de DNA baixa — atenção ao risco de churn; vale priorizar desenvolvimento.",
      className: "bg-red-50 text-red-700",
    };
  }

  if (highQuality && highOccupancy) {
    return {
      text: "Bem avaliado e com turmas cheias — combinação saudável; manter o padrão.",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (lowQuality && lowOccupancy) {
    return {
      text: "Avaliação baixa e baixa ocupação — prioridade de atenção (qualidade e captação).",
      className: "bg-red-50 text-red-700",
    };
  }

  return {
    text: "Qualidade e ocupação em patamar intermediário — espaço para evoluir nota de DNA e preencher vagas.",
    className: neutral,
  };
}

function GroupRevenueTable({
  title,
  firstColumn,
  rows,
  nameById,
  emptyName,
  totalRevenue,
  totalStudents,
}: {
  title: string;
  firstColumn: string;
  rows: TeacherGroupMetric[];
  nameById: Record<string, string>;
  emptyName: string;
  totalRevenue: number;
  totalStudents: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[420px] w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{firstColumn}</th>
              <th className="px-4 py-3">Turmas</th>
              <th className="px-4 py-3">Alunos</th>
              <th className="px-4 py-3">Receita mensal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id ?? "__none__"}>
                <td className="px-4 py-3 font-medium text-foreground">
                  {row.id ? nameById[row.id] ?? emptyName : emptyName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.classesCount}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.activeStudents}
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">
                  {formatCurrency(row.monthlyRevenue)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/40 text-sm font-semibold">
            <tr>
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3">{totalStudents}</td>
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
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
      {detail ? (
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
