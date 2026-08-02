import type {
  AudienceGrowthPoint,
  AudienceMetrics,
  AudienceSlice,
} from "@/features/audience-metrics/queries";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
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
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Ainda não há alunos com matrícula ativa para analisar.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AudienceKpis metrics={metrics} monthlyBase={monthlyBase} />

      <ChartCard
        title="Alunos por faixa etária"
        subtitle={`${formatNumber(metrics.ageValidCount)} cadastros com data de nascimento válida`}
      >
        <AgeBandColumns
          bands={metrics.ageBands}
          coreAgeCount={metrics.coreAgeCount}
          ageValidCount={metrics.ageValidCount}
          ageInvalidCount={metrics.ageInvalidCount}
        />
      </ChartCard>

      <ChartCard
        title="Composição"
        subtitle="Cada barra é proporcional ao total da sua linha"
      >
        <div className="space-y-5">
          <ShareBars
            label="Modalidade"
            slices={metrics.byModality}
            total={metrics.totalActiveStudents}
            totalLabel={`${formatNumber(metrics.totalActiveStudents)} alunos ativos`}
            note="Um aluno pode aparecer em mais de uma modalidade, então as partes somam mais de 100%."
          />
          <ShareBars
            label="Famílias"
            slices={metrics.familySizes}
            total={metrics.totalFamilies}
            totalLabel={`${formatNumber(metrics.totalFamilies)} famílias com matrícula ativa`}
          />
        </div>
      </ChartCard>

      {/* Nível e cadastros recentes dividem a última linha: os dois cabem em
          meia largura, ao contrário dos cards acima. */}
      <section className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Alunos por nível"
          subtitle="Alunos distintos por nível das turmas"
        >
          <BarList slices={metrics.byLevel} />
        </ChartCard>

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

/* ---------------------------- Faixa etária ---------------------------- */

/**
 * Colunas, não pizza.
 *
 * Faixa etária é variável ORDINAL — 4-6 vem antes de 7-9, que vem antes de
 * 10-12. A pizza embaralhava essa ordem e obrigava a percorrer a legenda para
 * reconstruir a distribuição. Em colunas ordenadas por idade, a forma da
 * distribuição — pico no miolo, cauda nos adultos — aparece de imediato, que
 * é a leitura que interessa.
 *
 * Uma cor só: aqui a cor não codificaria nada além da posição no array.
 */
function AgeBandColumns({
  bands,
  coreAgeCount,
  ageValidCount,
  ageInvalidCount,
}: {
  bands: AudienceSlice[];
  coreAgeCount: number;
  ageValidCount: number;
  ageInvalidCount: number;
}) {
  if (bands.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sem dados para exibir.
      </p>
    );
  }

  const max = Math.max(...bands.map((band) => band.count));
  const adults = bands
    .filter((band) => band.label === "19 a 25" || band.label === "26+")
    .reduce((sum, band) => sum + band.count, 0);

  return (
    <div>
      <div className="flex items-end gap-2">
        {bands.map((band) => (
          <div
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            key={band.label}
          >
            <span className="text-xs font-medium tabular-nums text-foreground">
              {formatNumber(band.count)}
            </span>

            {/* A trilha precisa de altura EXPLÍCITA. Antes o percentual da
                barra era medido contra uma coluna dimensionada pelo conteúdo,
                não resolvia, e todas as barras caíam no mínimo de 4px — sete
                faixas de valores diferentes viravam sete traços iguais. */}
            <div className="flex h-40 w-full items-end">
              <div
                className="w-full rounded-t bg-primary"
                style={{
                  height: `${max > 0 ? (band.count / max) * 100 : 0}%`,
                  minHeight: band.count > 0 ? 4 : 0,
                }}
                title={`${band.label} anos: ${formatNumber(band.count)}`}
              />
            </div>

            <span className="text-[11px] text-muted-foreground">
              {band.label}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {formatPercent(coreAgeCount, ageValidCount)} dos alunos entre 7 e 15
        anos · {formatPercent(adults, ageValidCount)} com 19 anos ou mais
      </p>

      {/* O aviso mora junto do gráfico que ele qualifica, não no rodapé da
          página. É a nota de rodapé desta análise. */}
      {ageInvalidCount > 0 ? (
        <Alert tone="warning" className="mt-3 text-xs">
          <span>
            {formatNumber(ageInvalidCount)}{" "}
            {ageInvalidCount === 1 ? "aluno está" : "alunos estão"} fora desta
            análise por não{" "}
            {ageInvalidCount === 1 ? "ter" : "terem"} data de nascimento válida
            no cadastro (ausente ou fora de 0 a 80 anos).{" "}
            <Link className="underline hover:no-underline" href="/alunos">
              Conferir cadastros
            </Link>
          </span>
        </Alert>
      ) : null}
    </div>
  );
}

/* ---------------------------- Barras de composição ---------------------------- */

/**
 * Três valores com uma parte dominante não precisam de um card de 400px.
 *
 * Barras SEPARADAS, não empilhadas, cada uma proporcional ao total da linha.
 * A empilhada seria mais compacta, mas promete um todo: no caso de
 * modalidade, um aluno pode estar em duas, as partes somam mais de 100% e a
 * promessa seria falsa. Separadas, cada barra diz só "esta parte, deste
 * total" — que é o que os dados sustentam.
 */
function ShareBars({
  label,
  slices,
  total,
  totalLabel,
  note,
}: {
  label: string;
  slices: AudienceSlice[];
  total: number;
  totalLabel: string;
  note?: string;
}) {
  if (slices.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <span className="text-xs text-muted-foreground">{totalLabel}</span>
      </div>

      <ul className="mt-2 space-y-2">
        {slices.map((slice) => (
          <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3" key={slice.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-foreground">{slice.label}</span>
            </div>
            <span className="tabular-nums text-sm text-muted-foreground">
              {formatNumber(slice.count)} ({formatPercent(slice.count, total)})
            </span>
            <div className="col-span-2 mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${total > 0 ? Math.min(100, (slice.count / total) * 100) : 0}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      {note ? (
        <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

/* --------------------------- Horizontal bars --------------------------- */

/** Acima disto é cauda: no dado real, do sétimo nível em diante ninguém lê. */
const VISIBLE_BARS = 6;

/**
 * Uma cor, não onze.
 *
 * Cada barra tinha uma cor diferente da paleta categórica, indexada pela
 * posição no array. As cores não codificavam nada — e o olho tenta achar
 * significado onde não há. Onde a cor precisa significar algo, ela significa
 * (ver a faixa de desempenho em docs/identidade-visual.md); onde não precisa,
 * é ruído.
 */
function BarList({ slices }: { slices: AudienceSlice[] }) {
  if (slices.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sem dados para exibir.
      </p>
    );
  }

  const max = Math.max(...slices.map((slice) => slice.count));
  const visible = slices.slice(0, VISIBLE_BARS);
  const rest = slices.slice(VISIBLE_BARS);

  return (
    <div>
      <BarRows slices={visible} max={max} />

      {/* <details> em vez de estado: mantém o arquivo como server component. */}
      {rest.length > 0 ? (
        <details className="mt-2.5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-primary hover:underline">
            Ver todos os {slices.length}
          </summary>
          <div className="mt-2.5">
            <BarRows slices={rest} max={max} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function BarRows({ slices, max }: { slices: AudienceSlice[]; max: number }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {slices.map((slice) => (
        <li key={slice.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">{slice.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatNumber(slice.count)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${max > 0 ? (slice.count / max) * 100 : 0}%` }}
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
    <div className="rounded-xl border border-border bg-card p-5">
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

