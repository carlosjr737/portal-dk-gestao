import type {
  AudienceGrowthPoint,
  AudienceMetrics,
  AudienceSlice,
} from "@/features/audience-metrics/queries";
import { Alert } from "@/components/ui/alert";
import { PALETA_CATEGORICA } from "@/lib/chart-palette";
import {
  findBulkLoadPoint,
  modalityConcentration,
  recentSignups,
  singleChildFamilies,
  studentsPerFamily,
} from "@/features/audience-metrics/derived";
import type { MonthlyBasePoint } from "@/features/school-metrics/monthly-base";
import { studentsDelta } from "@/features/school-metrics/derived";
import { MetricCard } from "@/components/ui/metric-card";

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(part: number, total: number) {
  if (total <= 0) {
    return "0%";
  }
  return `${Math.round((part / total) * 100)}%`;
}

const decimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

function formatDecimal(value: number) {
  return decimalFormatter.format(value);
}


type AudienceMetricsViewProps = {
  metrics: AudienceMetrics;
  monthlyBase?: MonthlyBasePoint[];
};

export function AudienceMetricsView({
  metrics,
  monthlyBase,
}: AudienceMetricsViewProps) {
  if (!metrics.available || metrics.totalActiveStudents === 0) {
    return (
      <div className="rounded-lg border border-border bg-white p-8 text-center text-sm text-muted-foreground">
        Ainda não há alunos com matrícula ativa para analisar.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AudienceKpis metrics={metrics} monthlyBase={monthlyBase} />

      {/* Pizzas: idade e modalidade */}
      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Alunos por faixa etária"
          subtitle={`${formatNumber(metrics.totalActiveStudents)} alunos ativos`}
        >
          <PieChart slices={metrics.ageBands} />
        </ChartCard>

        <ChartCard
          title="Alunos por modalidade"
          subtitle="Um aluno pode aparecer em mais de uma modalidade"
        >
          <PieChart slices={metrics.byModality} />
        </ChartCard>
      </section>

      {/* Famílias (pizza) e nível (barras) */}
      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Famílias por nº de filhos"
          subtitle={`${formatNumber(metrics.totalFamilies)} famílias com matrícula ativa`}
        >
          <PieChart slices={metrics.familySizes} />
        </ChartCard>

        <ChartCard
          title="Alunos por nível"
          subtitle="Alunos distintos por nível das turmas"
        >
          <BarList slices={metrics.byLevel} />
        </ChartCard>
      </section>

      {/* Cadastros recentes (largura total) */}
      <section>
        <ChartCard
          title="Cadastros recentes"
          subtitle="Data de cadastro no sistema, não data de entrada na escola"
        >
          <RecentSignupsSummary
            points={metrics.growth}
            totalActiveStudents={metrics.totalActiveStudents}
          />
        </ChartCard>
      </section>

      {metrics.ageInvalidCount > 0 ? (
        <Alert tone="warning" className="text-xs">
          ⚠️ {metrics.ageInvalidCount}{" "}
          {metrics.ageInvalidCount === 1 ? "aluno tem" : "alunos têm"} data de
          nascimento provavelmente incorreta (idade fora de 0–80 anos) e{" "}
          {metrics.ageInvalidCount === 1 ? "foi excluído" : "foram excluídos"} da
          análise de idade. Vale conferir o cadastro.
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * Quatro indicadores, e um deles aponta dinheiro.
 *
 * Os cinco anteriores eram todos descritivos: respondiam "quem são" e não
 * respondiam "e daí". Nenhum apontava ação, e a maior oportunidade comercial
 * da escola estava escondida numa pizza de rodapé.
 */
function AudienceKpis({
  metrics,
  monthlyBase,
}: {
  metrics: AudienceMetrics;
  monthlyBase?: MonthlyBasePoint[];
}) {
  const perFamily = studentsPerFamily(metrics);
  const singleChild = singleChildFamilies(metrics);
  const concentration = modalityConcentration(metrics);
  const delta = studentsDelta(monthlyBase);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Alunos ativos"
        value={formatNumber(metrics.totalActiveStudents)}
        href="/alunos"
        delta={
          delta === null
            ? undefined
            : { value: delta, kind: "absolute", hint: "vs. mês anterior" }
        }
        hint="Com pelo menos uma matrícula ativa"
      />

      {/* O principal da tela: irmão de aluno matriculado é o lead mais barato
          que existe, e esse número estava numa pizza de rodapé. */}
      <MetricCard
        label="Famílias"
        value={formatNumber(metrics.totalFamilies)}
        href="/responsaveis"
        hint={
          <>
            {perFamily === null
              ? "Responsáveis financeiros distintos"
              : `${formatDecimal(perFamily)} aluno por família`}
            {singleChild
              ? ` · ${formatNumber(singleChild.count)} com um filho só`
              : ""}
          </>
        }
      />

      {/* Mediana no tamanho grande, média rebaixada para apoio: a média é
          puxada para cima pela cauda de adultos e faz parecer uma escola de
          adolescentes. A mediana descreve o aluno típico. */}
      <MetricCard
        label="Idade"
        value={
          metrics.medianAgeBand ? `${metrics.medianAgeBand} anos` : "—"
        }
        hint={
          metrics.averageAge === null
            ? "Faixa mediana dos cadastros com data válida"
            : `média ${formatDecimal(metrics.averageAge)} · ${formatPercent(
                metrics.coreAgeCount,
                metrics.ageValidCount,
              )} entre 7 e 15`
        }
      />

      {concentration ? (
        <MetricCard
          label="Concentração"
          value={`${formatPercent(
            concentration.top.count,
            metrics.totalActiveStudents,
          )} em ${concentration.top.label}`}
          href="/modalidades"
          hint={
            concentration.rest.length > 0
              ? concentration.rest
                  .slice(0, 2)
                  .map(
                    (slice) =>
                      `${slice.label} ${formatPercent(
                        slice.count,
                        metrics.totalActiveStudents,
                      )}`,
                  )
                  .join(" · ")
              : "Única modalidade com alunos ativos"
          }
        />
      ) : null}
    </section>
  );
}

/* ----------------------------- Pie chart ----------------------------- */

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function PieChart({ slices }: { slices: AudienceSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sem dados para exibir.
      </p>
    );
  }

  const cx = 100;
  const cy = 100;
  const r = 92;

  let cursor = 0;
  const arcs = slices.map((slice, index) => {
    const startAngle = (cursor / total) * 360;
    cursor += slice.count;
    const endAngle = (cursor / total) * 360;
    return {
      ...slice,
      color: PALETA_CATEGORICA[index % PALETA_CATEGORICA.length],
      path:
        slices.length === 1
          ? null // círculo cheio renderizado à parte
          : arcPath(cx, cy, r, startAngle, endAngle),
    };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg
        viewBox="0 0 200 200"
        className="h-44 w-44 shrink-0"
        role="img"
        aria-label="Gráfico de pizza"
      >
        {slices.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={arcs[0].color} />
        ) : (
          arcs.map((arc) => (
            <path
              key={arc.label}
              d={arc.path ?? ""}
              fill={arc.color}
              stroke="hsl(var(--card))"
              strokeWidth={1.5}
            />
          ))
        )}
      </svg>

      <ul className="flex w-full flex-col gap-1.5">
        {arcs.map((arc) => (
          <li
            key={arc.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2 text-foreground">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: arc.color }}
              />
              {arc.label}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatNumber(arc.count)} ({formatPercent(arc.count, total)})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------- Horizontal bars --------------------------- */

function BarList({ slices }: { slices: AudienceSlice[] }) {
  if (slices.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sem dados para exibir.
      </p>
    );
  }

  const max = Math.max(...slices.map((slice) => slice.count));

  return (
    <ul className="flex flex-col gap-2.5">
      {slices.map((slice, index) => (
        <li key={slice.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">{slice.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatNumber(slice.count)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${max > 0 ? (slice.count / max) * 100 : 0}%`,
                backgroundColor: PALETA_CATEGORICA[index % PALETA_CATEGORICA.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------- Cadastros recentes ---------------------------- */

/**
 * Uma frase, não um gráfico.
 *
 * O gráfico de barras que existia aqui era ilegível por escala: um mês tinha
 * 541 cadastros — a carga inicial da base — e os demais tinham 1, 2 ou 3.
 * Com o máximo em 541, um mês de 3 alunos renderizava a 0,55% de 176px, ou
 * seja menos de um pixel. Doze meses de dado invisíveis por causa de um ponto.
 *
 * Corrigir a escala não bastaria: enquanto o volume orgânico for de 1 a 3 por
 * mês, uma barra de 2px não comunica nada que a frase não comunique melhor.
 */
function RecentSignupsSummary({
  points,
  totalActiveStudents,
}: {
  points: AudienceGrowthPoint[];
  totalActiveStudents: number;
}) {
  const bulkLoad = findBulkLoadPoint(points, totalActiveStudents);
  const recent = recentSignups(points, bulkLoad);

  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">
        <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums">
          {formatNumber(recent.count)}
        </span>{" "}
        {recent.count === 1 ? "aluno cadastrado" : "alunos cadastrados"} nos
        últimos {recent.months} meses
        {recent.lastLabel ? ` · último em ${recent.lastLabel}` : ""}
      </p>

      {bulkLoad ? (
        <p className="text-xs text-muted-foreground">
          Fora da conta: {formatNumber(bulkLoad.count)} cadastros de{" "}
          {bulkLoad.label} são a carga inicial da base — data do import, não
          captação.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------- Shells ------------------------------- */

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

