import type { MonthlyBasePoint } from "@/features/school-metrics/monthly-base";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
} from "@/components/ui/table";

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
        <h2 className="text-sm font-semibold text-foreground">
          Base ativa por mês
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Matrículas e alunos distintos ativos no fim de cada mês, reconstruído
          a partir das datas de início e cancelamento das matrículas do sistema.
        </p>
      </div>

      {/* px-5 nas células para acompanhar o padding do cabeçalho da seção. */}
      <Table
        containerClassName="rounded-none border-0"
        className="[&_td]:px-5 [&_th]:px-5"
        minWidth="560px"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead className="text-right tabular-nums">Matrículas ativas</TableHead>
            <TableHead className="text-right tabular-nums">Variação</TableHead>
            <TableHead className="text-right tabular-nums">Alunos ativos</TableHead>
            <TableHead className="text-right tabular-nums">Variação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {points.length === 0 ? (
            <TableEmpty colSpan={5}>
              Ainda não há meses fechados para comparar.
            </TableEmpty>
          ) : null}
          {points.map((point, index) => {
            const prev = index > 0 ? points[index - 1] : null;
            const dEnr = prev ? point.enrollments - prev.enrollments : 0;
            const dStu = prev ? point.students - prev.students : 0;
            return (
              <TableRow key={point.month}>
                <TableCell className="font-medium text-foreground">
                  {point.label}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">
                  {numberFormatter.format(point.enrollments)}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${deltaClass(dEnr)}`}>
                  {index === 0 ? "—" : formatDelta(dEnr)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">
                  {numberFormatter.format(point.students)}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${deltaClass(dStu)}`}>
                  {index === 0 ? "—" : formatDelta(dStu)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Reflete o roster real do sistema (matrículas cadastradas + cancelamentos
        registrados). O churn histórico da planilha não entra aqui — esse fica no
        painel Growth &amp; Churn.
      </p>
    </section>
  );
}
