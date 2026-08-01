import type { SchoolClassRevenueMetric } from "@/features/school-metrics/queries";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        <Table containerClassName="rounded-none border-0" minWidth="980px">
          <TableHeader>
            <TableRow>
              <TableHead>Turma</TableHead>
              <TableHead>Professor</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead className="text-right">Alunos</TableHead>
              <TableHead className="text-right">Desconto</TableHead>
              <TableHead className="text-right">Ticket médio</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.classId}>
                  <TableCell className="font-medium text-foreground">
                    {row.className}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.teacherName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.levelName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.scheduleLabel}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.activeStudents}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.totalDiscount > 0
                      ? `- ${formatCurrencyBRL(row.totalDiscount)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrencyBRL(row.averageTicketPerEnrollment)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {formatCurrencyBRL(row.monthlyRevenue)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty colSpan={8}>
                Nenhuma turma com matrícula ativa.
              </TableEmpty>
            )}
          </TableBody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <TableCell className="text-foreground" colSpan={4}>
                Total
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground">
                {totalStudents}
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground">
                {totalDiscount > 0 ? `- ${formatCurrencyBRL(totalDiscount)}` : "—"}
              </TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums text-foreground">
                {formatCurrencyBRL(totalRevenue)}
              </TableCell>
            </tr>
          </tfoot>
        </Table>
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
