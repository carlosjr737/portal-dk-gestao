import type { MonthlyBasePoint } from "@/features/school-metrics/monthly-base";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatDelta(value: number) {
  if (value === 0) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)}`;
}

function deltaClass(value: number) {
  if (value > 0) return "text-success-text";
  if (value < 0) return "text-danger-text";
  return "text-muted-foreground";
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 160;
const CHART_PAD = 8;

type Series = {
  key: "enrollments" | "students";
  label: string;
  color: string;
  values: number[];
};

/**
 * Uma série temporal exibida como planilha é a forma em que a tendência é
 * mais difícil de ver. O gráfico vem primeiro; a tabela continua existindo
 * atrás de "Ver dados", porque quem precisa do número exato do mês ainda
 * precisa dele — só não precisa dele aberto por padrão.
 *
 * O <Sparkline> do design system não serve aqui: desenha uma série só, sem
 * eixo e sem hover, e seu preserveAspectRatio="none" distorceria qualquer
 * texto dentro do SVG. Por isso os rótulos de mês são HTML abaixo do
 * desenho, imunes ao esticamento do viewBox.
 *
 * Server component de propósito: <details> dá o colapso sem estado nem JS,
 * e é acessível por teclado de graça.
 */
export function MonthlyBaseView({ points }: { points: MonthlyBasePoint[] }) {
  if (points.length === 0) {
    return null;
  }

  const series: Series[] = [
    {
      key: "enrollments",
      label: "Matrículas ativas",
      color: "hsl(var(--primary))",
      values: points.map((point) => point.enrollments),
    },
    {
      key: "students",
      label: "Alunos distintos",
      color: "hsl(var(--info))",
      values: points.map((point) => point.students),
    },
  ];

  const first = points[0];
  const last = points[points.length - 1];
  const totalEnrollmentsDelta = last.enrollments - first.enrollments;
  const totalStudentsDelta = last.students - first.students;

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Base ativa por mês
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Matrículas e alunos distintos ativos no fim de cada mês, reconstruído
          a partir das datas de início e cancelamento das matrículas do sistema.
        </p>
      </div>

      <div className="px-5 py-4">
        <MonthlyBaseChart points={points} series={series} />

        <p className="mt-3 text-sm text-foreground">
          De {first.label} a {last.label}:{" "}
          <span className={`tabular-nums ${deltaClass(totalEnrollmentsDelta)}`}>
            {formatDelta(totalEnrollmentsDelta)} matrículas
          </span>{" "}
          ·{" "}
          <span className={`tabular-nums ${deltaClass(totalStudentsDelta)}`}>
            {formatDelta(totalStudentsDelta)} alunos
          </span>
        </p>
      </div>

      <details className="border-t border-border">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-primary hover:underline">
          Ver dados
        </summary>

        {/* px-5 nas células para acompanhar o padding do cabeçalho da seção. */}
        <Table
          containerClassName="rounded-none border-0"
          className="[&_td]:px-5 [&_th]:px-5"
          minWidth="560px"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right tabular-nums">
                Matrículas ativas
              </TableHead>
              <TableHead className="text-right tabular-nums">Variação</TableHead>
              <TableHead className="text-right tabular-nums">
                Alunos ativos
              </TableHead>
              <TableHead className="text-right tabular-nums">Variação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
                  <TableCell
                    className={`text-right tabular-nums ${deltaClass(dEnr)}`}
                  >
                    {index === 0 ? "—" : formatDelta(dEnr)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {numberFormatter.format(point.students)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${deltaClass(dStu)}`}
                  >
                    {index === 0 ? "—" : formatDelta(dStu)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </details>

      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Reflete o roster real do sistema (matrículas cadastradas + cancelamentos
        registrados). O churn histórico da planilha não entra aqui — esse fica no
        painel Growth &amp; Churn.
      </p>
    </section>
  );
}

function MonthlyBaseChart({
  points,
  series,
}: {
  points: MonthlyBasePoint[];
  series: Series[];
}) {
  // Uma linha reta entre dois pontos não é tendência. Sem o segundo mês,
  // só a tabela informa.
  if (points.length < 2) {
    return null;
  }

  const values = series.flatMap((item) => item.values);
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Escala com folga em vez de começar no zero: a variação da base é de
  // poucos por cento, e uma escala do zero achataria tudo numa reta.
  const span = max - min || 1;

  const x = (index: number) =>
    CHART_PAD +
    (index / (points.length - 1)) * (CHART_WIDTH - CHART_PAD * 2);
  const y = (value: number) =>
    CHART_HEIGHT -
    CHART_PAD -
    ((value - min) / span) * (CHART_HEIGHT - CHART_PAD * 2);

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {series.map((item) => (
          <li className="flex items-center gap-1.5" key={item.key}>
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </li>
        ))}
      </ul>

      <svg
        className="h-40 w-full"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Evolução mensal de ${series
          .map((item) => item.label.toLowerCase())
          .join(" e ")}, de ${points[0].label} a ${
          points[points.length - 1].label
        }`}
      >
        {series.map((item) => (
          <g key={item.key}>
            <polyline
              fill="none"
              stroke={item.color}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              points={item.values
                .map((value, index) => `${x(index)},${y(value)}`)
                .join(" ")}
            />
            {item.values.map((value, index) => {
              const previous = index > 0 ? item.values[index - 1] : null;
              const delta = previous === null ? null : value - previous;

              return (
                <circle
                  cx={x(index)}
                  cy={y(value)}
                  fill={item.color}
                  key={points[index].month}
                  r={2.4}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>
                    {points[index].label}: {numberFormatter.format(value)}{" "}
                    {item.label.toLowerCase()}
                    {delta === null ? "" : ` (${formatDelta(delta)})`}
                  </title>
                </circle>
              );
            })}
          </g>
        ))}
      </svg>

      {/* Rótulos fora do SVG: o viewBox estica na horizontal e deformaria
          qualquer <text> dentro dele. */}
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        {points.map((point) => (
          <span key={point.month}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}
