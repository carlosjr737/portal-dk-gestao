import { ES_DATA, type EsPoint } from "@/features/entradas-saidas/data";

const nf = new Intl.NumberFormat("pt-BR");
const pf = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

function fmt(v: number | null) {
  return v === null ? "—" : nf.format(Math.round(v));
}
function fmtDelta(v: number | null) {
  if (v === null) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${nf.format(Math.round(v))}`;
}
function deltaClass(v: number | null) {
  if (v === null || v === 0) return "text-muted-foreground";
  return v > 0 ? "text-emerald-700" : "text-rose-700";
}

/** Última linha com totalAlunos preenchido. */
function latestWith<K extends keyof EsPoint>(key: K): EsPoint | null {
  for (let i = ES_DATA.length - 1; i >= 0; i -= 1) {
    if (ES_DATA[i][key] !== null) return ES_DATA[i];
  }
  return null;
}

export function EntradasSaidasDashboard() {
  const latestTotals = latestWith("totalAlunos");
  const latestFlow = latestWith("novosAlunos");
  const totalsIndex = latestTotals ? ES_DATA.indexOf(latestTotals) : -1;
  const prevTotals = totalsIndex > 0 ? ES_DATA[totalsIndex - 1] : null;

  const dAlunos =
    latestTotals && prevTotals && prevTotals.totalAlunos !== null
      ? (latestTotals.totalAlunos ?? 0) - prevTotals.totalAlunos
      : null;
  const dMatriculas =
    latestTotals && prevTotals && prevTotals.totalMatriculas !== null
      ? (latestTotals.totalMatriculas ?? 0) - prevTotals.totalMatriculas
      : null;

  const labels = ES_DATA.map((d) => d.label);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Alunos ativos"
          value={fmt(latestTotals?.totalAlunos ?? null)}
          detail={latestTotals?.label}
          delta={dAlunos}
        />
        <MetricCard
          label="Matrículas ativas"
          value={fmt(latestTotals?.totalMatriculas ?? null)}
          detail={latestTotals?.label}
          delta={dMatriculas}
        />
        <MetricCard
          label="Novos alunos"
          value={fmt(latestFlow?.novosAlunos ?? null)}
          detail={`Entradas em ${latestFlow?.label ?? "—"}`}
        />
        <MetricCard
          label="Saídas de alunos"
          value={fmt(latestFlow?.saidaAlunos ?? null)}
          detail={`Churn em ${latestFlow?.label ?? "—"}`}
        />
      </section>

      <ChartCard
        title="Total de alunos e matrículas"
        subtitle="Evolução mês a mês desde 2023"
        legend={[
          { name: "Alunos", color: "#6366f1" },
          { name: "Matrículas", color: "#22c55e" },
        ]}
      >
        <LineChart
          labels={labels}
          series={[
            { color: "#6366f1", values: ES_DATA.map((d) => d.totalAlunos) },
            { color: "#22c55e", values: ES_DATA.map((d) => d.totalMatriculas) },
          ]}
        />
      </ChartCard>

      <ChartCard
        title="Saldo de alunos por mês"
        subtitle="Entradas menos saídas (verde = cresceu, vermelho = encolheu)"
      >
        <SignedBars labels={labels} values={ES_DATA.map((d) => d.netAlunos)} />
      </ChartCard>

      <ChartCard
        title="Growth % e Churn % (alunos)"
        subtitle="Percentual de crescimento e de saída sobre a base do mês"
        legend={[
          { name: "Growth", color: "#22c55e" },
          { name: "Churn", color: "#ef4444" },
        ]}
      >
        <LineChart
          labels={labels}
          percent
          series={[
            { color: "#22c55e", values: ES_DATA.map((d) => d.growth) },
            { color: "#ef4444", values: ES_DATA.map((d) => d.churnAlunos) },
          ]}
        />
      </ChartCard>

      <YearTable />
    </div>
  );
}

/* ------------------------------- Line chart ------------------------------- */

function LineChart({
  labels,
  series,
  percent = false,
}: {
  labels: string[];
  series: { color: string; values: (number | null)[] }[];
  percent?: boolean;
}) {
  const W = 820;
  const H = 300;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const max = all.length ? Math.max(...all) : 1;
  const min = percent ? 0 : Math.min(...all, 0);
  const span = max - min || 1;
  const n = labels.length;
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1);
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / span);

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((t) => min + span * t);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-72 w-full min-w-[640px]">
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(gv)}
              y2={y(gv)}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text x={4} y={y(gv) + 4} fontSize={10} fill="#9ca3af">
              {percent ? pf.format(gv) : nf.format(Math.round(gv))}
            </text>
          </g>
        ))}
        {labels.map((lb, i) =>
          lb.startsWith("jan") || i === n - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              fontSize={10}
              fill="#9ca3af"
              textAnchor="middle"
            >
              {lb}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const segs: string[] = [];
          let cur: string[] = [];
          s.values.forEach((v, i) => {
            if (v === null) {
              if (cur.length) segs.push(cur.join(" "));
              cur = [];
            } else {
              cur.push(`${cur.length ? "L" : "M"} ${x(i)} ${y(v)}`);
            }
          });
          if (cur.length) segs.push(cur.join(" "));
          return (
            <g key={si}>
              {segs.map((d, k) => (
                <path key={k} d={d} fill="none" stroke={s.color} strokeWidth={2} />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------ Signed bars ------------------------------ */

function SignedBars({
  labels,
  values,
}: {
  labels: string[];
  values: (number | null)[];
}) {
  const nums = values.filter((v): v is number => v !== null);
  const max = Math.max(1, ...nums.map((v) => Math.abs(v)));
  return (
    <div className="flex h-52 items-stretch gap-[2px] overflow-x-auto">
      {values.map((v, i) => {
        const pct = v === null ? 0 : (Math.abs(v) / max) * 50;
        const up = (v ?? 0) >= 0;
        return (
          <div
            key={i}
            className="flex min-w-[10px] flex-1 flex-col items-center"
            title={`${labels[i]}: ${v === null ? "—" : v}`}
          >
            <div className="flex h-1/2 w-full items-end justify-center">
              {up && v !== null ? (
                <div
                  className="w-full rounded-t bg-emerald-500"
                  style={{ height: `${pct}%` }}
                />
              ) : null}
            </div>
            <div className="h-px w-full bg-border" />
            <div className="flex h-1/2 w-full items-start justify-center">
              {!up && v !== null ? (
                <div
                  className="w-full rounded-b bg-rose-500"
                  style={{ height: `${pct}%` }}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- Year table ------------------------------- */

function YearTable() {
  const years = [...new Set(ES_DATA.map((d) => d.year))];
  const rows = years.map((year) => {
    const pts = ES_DATA.filter((d) => d.year === year);
    const last = [...pts].reverse().find((d) => d.totalAlunos !== null);
    const sum = (k: keyof EsPoint) =>
      pts.reduce((acc, d) => acc + ((d[k] as number | null) ?? 0), 0);
    return {
      year,
      alunos: last?.totalAlunos ?? null,
      matriculas: last?.totalMatriculas ?? null,
      novos: sum("novosAlunos"),
      saidas: sum("saidaAlunos"),
      net: sum("netAlunos"),
    };
  });

  return (
    <section className="overflow-hidden rounded-md border border-border bg-white">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">Resumo por ano</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Base no fim do ano e fluxo acumulado de alunos.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-semibold">Ano</th>
              <th className="px-5 py-3 text-right font-semibold">Alunos (fim)</th>
              <th className="px-5 py-3 text-right font-semibold">Matrículas (fim)</th>
              <th className="px-5 py-3 text-right font-semibold">Novos</th>
              <th className="px-5 py-3 text-right font-semibold">Saídas</th>
              <th className="px-5 py-3 text-right font-semibold">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.year} className="hover:bg-muted/50">
                <td className="px-5 py-3 font-medium text-foreground">{r.year}</td>
                <td className="px-5 py-3 text-right tabular-nums text-foreground">
                  {fmt(r.alunos)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-foreground">
                  {fmt(r.matriculas)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-emerald-700">
                  {fmt(r.novos)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-rose-700">
                  {fmt(r.saidas)}
                </td>
                <td className={`px-5 py-3 text-right tabular-nums ${deltaClass(r.net)}`}>
                  {fmtDelta(r.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --------------------------------- Shells --------------------------------- */

function ChartCard({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: { name: string; color: string }[];
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-white p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {legend ? (
          <div className="flex flex-wrap gap-3">
            {legend.map((l) => (
              <span key={l.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: l.color }}
                />
                {l.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  delta,
}: {
  label: string;
  value: string;
  detail?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {delta !== undefined ? (
          <span className={`text-sm font-medium ${deltaClass(delta ?? null)}`}>
            {fmtDelta(delta ?? null)}
          </span>
        ) : null}
      </div>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
