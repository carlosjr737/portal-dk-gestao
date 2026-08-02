import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { getClassPerformanceStatus } from "@/lib/class-performance";
import { getMonthlyActiveBase } from "@/features/school-metrics/monthly-base";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";

export const dynamic = "force-dynamic";

/*
 * Nenhum número desta tela é decorativo. Tudo que aparece aqui sai de
 * query — se um dado não existe ainda (comparação de faturamento mês a
 * mês, por exemplo), o bloco não aparece em vez de aparecer com valor
 * inventado. Painel em que um número é chute é painel em que nenhum número
 * é confiável.
 */

type DashboardClass = {
  id: string;
  name: string;
  room: string | null;
  instructorName: string | null;
  capacity: number | null;
  activeEnrollmentsCount: number;
};

type OccupancyBucket = {
  key: "cti" | "recovery" | "high" | "high_performance";
  label: string;
  range: string;
  count: number;
  /** Cor de PREENCHIMENTO da faixa na barra. */
  fill: string;
  /** Variante legível do mesmo tom, para o número ao lado do rótulo. */
  text: string;
};

type DashboardData = {
  activeStudentsCount: number;
  activeEnrollmentsCount: number;
  totalClassesCount: number;
  contractedMonthly: number;
  buckets: OccupancyBucket[];
  needsAttention: DashboardClass[];
  classesByRoom: { room: string; count: number }[];
  studentSeries: number[];
  enrollmentSeries: number[];
  seriesLabel: string | null;
  loadError: string | null;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export default async function DashboardPage() {
  const data = await getDashboardData();
  const totalInBuckets = data.buckets.reduce((sum, b) => sum + b.count, 0);
  const abaixoDaMeta = data.buckets
    .filter((b) => b.key === "cti" || b.key === "recovery")
    .reduce((sum, b) => sum + b.count, 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral de ocupação e indicadores operacionais da escola."
      />

      {data.loadError ? (
        <Alert tone="warning" className="mt-6">
          Não foi possível carregar alguns dados. Os indicadores abaixo podem
          estar incompletos.
        </Alert>
      ) : null}

      {/* 01 — Resumo executivo */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Alunos ativos"
          value={String(data.activeStudentsCount)}
          series={data.studentSeries}
          seriesLabel={data.seriesLabel}
        />
        <MetricCard
          icon={ClipboardList}
          label="Matrículas ativas"
          value={String(data.activeEnrollmentsCount)}
          hint={
            data.activeStudentsCount > 0
              ? `${(data.activeEnrollmentsCount / data.activeStudentsCount)
                  .toFixed(2)
                  .replace(".", ",")} turmas por aluno`
              : undefined
          }
          series={data.enrollmentSeries}
          seriesLabel={data.seriesLabel}
        />
        <MetricCard
          icon={Banknote}
          label="Mensalidades contratadas"
          value={brl.format(data.contractedMonthly)}
          hint={
            data.activeEnrollmentsCount > 0
              ? `${brl.format(
                  data.contractedMonthly / data.activeEnrollmentsCount,
                )} por matrícula`
              : undefined
          }
        />
        <MetricCard
          icon={GraduationCap}
          label="Turmas ativas"
          value={String(data.totalClassesCount)}
          hint={
            data.totalClassesCount > 0
              ? `${(data.activeEnrollmentsCount / data.totalClassesCount)
                  .toFixed(1)
                  .replace(".", ",")} alunos por turma`
              : undefined
          }
        />
      </section>

      {/* 03 — Operação: a barra é a tela inteira em uma linha */}
      <section className="mt-3">
        <Card className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold text-foreground">
                Ocupação das turmas
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {totalInBuckets} turmas ativas, distribuídas por número de alunos
              </p>
            </div>
            <Link
              href="/turmas"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
            >
              Ver todas as turmas
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {totalInBuckets > 0 ? (
            <>
              <div className="mt-4 flex overflow-hidden rounded-lg">
                {data.buckets
                  .filter((bucket) => bucket.count > 0)
                  .map((bucket) => (
                    <div
                      key={bucket.key}
                      className="flex items-center justify-center py-2.5"
                      style={{
                        width: `${(bucket.count / totalInBuckets) * 100}%`,
                        background: bucket.fill,
                      }}
                      title={`${bucket.label}: ${bucket.count}`}
                    >
                      <span className="text-[13px] font-semibold tabular-nums text-white">
                        {bucket.count}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {data.buckets.map((bucket) => (
                  <Link
                    key={bucket.key}
                    href="/turmas"
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition hover:border-input hover:bg-muted"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: bucket.fill }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {bucket.label}
                        </span>
                        <span className="block text-[11.5px] text-muted-foreground">
                          {bucket.range}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        className="text-[17px] font-semibold tabular-nums"
                        style={{ color: bucket.text }}
                      >
                        {bucket.count}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma turma ativa cadastrada. Comece em Turmas.
            </p>
          )}
        </Card>
      </section>

      {/* 02 — Precisam de atenção, como fila acionável */}
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-4">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-danger-tint text-danger-text">
                <TriangleAlert className="h-[15px] w-[15px]" aria-hidden="true" />
              </span>
              <h2 className="text-[17px] font-semibold text-foreground">
                Precisam de atenção
              </h2>
            </div>
            <span className="text-[12px] text-muted-foreground">
              menos alunos ativos primeiro
            </span>
          </div>

          {data.needsAttention.length > 0 ? (
            <>
              <ul className="divide-y divide-border border-t border-border">
                {data.needsAttention.map((danceClass) => (
                  <li key={danceClass.id}>
                    <Link
                      href={`/turmas/${danceClass.id}`}
                      className="flex items-center gap-4 px-5 py-3 transition hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[13.5px] font-medium text-foreground">
                          {danceClass.name}
                        </span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          {[danceClass.instructorName, danceClass.room]
                            .filter(Boolean)
                            .join(" · ") || "Sem professor definido"}
                        </span>
                      </span>
                      <OccupancyMeter
                        active={danceClass.activeEnrollmentsCount}
                        capacity={danceClass.capacity}
                      />
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              {abaixoDaMeta > data.needsAttention.length ? (
                <div className="border-t border-border px-5 py-3">
                  <Link
                    href="/turmas"
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
                  >
                    Ver as {abaixoDaMeta} turmas abaixo da meta
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhuma turma abaixo de 11 alunos ativos. Nada exigindo ação agora.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-muted-foreground">
              <DoorOpen className="h-[15px] w-[15px]" aria-hidden="true" />
            </span>
            <h2 className="text-[17px] font-semibold text-foreground">
              Turmas por sala
            </h2>
          </div>

          {data.classesByRoom.length > 0 ? (
            <div className="mt-4 space-y-3.5">
              {data.classesByRoom.map((room) => {
                const maior = data.classesByRoom[0]?.count || 1;
                return (
                  <div key={room.room}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {room.room}
                      </span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {room.count}
                        </span>{" "}
                        turmas
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(room.count / maior) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma turma com sala definida.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- UI ---- */

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  series?: number[];
  seriesLabel?: string | null;
};

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  series,
  seriesLabel,
}: MetricCardProps) {
  const delta = series && series.length >= 2 ? monthDelta(series) : null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
          </span>
          <span className="truncate text-[12.5px] font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        {delta !== null ? <DeltaChip percent={delta} /> : null}
      </div>

      <p className="mt-3 text-[28px] font-bold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>
      ) : null}

      {series && series.length >= 2 ? (
        <>
          <Sparkline
            values={series}
            color="hsl(var(--primary))"
            className="mt-3 h-9 w-full"
            label={`Evolução de ${label.toLowerCase()}`}
          />
          {seriesLabel ? (
            <p className="mt-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {seriesLabel}
            </p>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

function DeltaChip({ percent }: { percent: number }) {
  if (percent === 0) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-muted-foreground">
        0,0%
      </span>
    );
  }

  const subiu = percent > 0;
  const Icon = subiu ? TrendingUp : TrendingDown;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold tabular-nums ${
        subiu ? "bg-success-tint text-success-text" : "bg-danger-tint text-danger-text"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {subiu ? "+" : ""}
      {percent.toFixed(1).replace(".", ",")}%
    </span>
  );
}

function OccupancyMeter({
  active,
  capacity,
}: {
  active: number;
  capacity: number | null;
}) {
  const status = getClassPerformanceStatus(active);
  const color =
    status.tone === "danger" ? "hsl(var(--danger))" : "hsl(var(--warning))";
  const pct = capacity && capacity > 0 ? Math.min(100, (active / capacity) * 100) : null;

  return (
    <span className="hidden w-28 shrink-0 sm:block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
          {active}
        </span>
        {capacity ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            / {capacity}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">ativos</span>
        )}
      </span>
      {pct !== null ? (
        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, background: color }}
          />
        </span>
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------- dados ---- */

/** Variação percentual do último mês fechado contra o anterior. */
function monthDelta(series: number[]) {
  const atual = series[series.length - 1];
  const anterior = series[series.length - 2];
  if (!anterior) return 0;
  return ((atual - anterior) / anterior) * 100;
}

async function getDashboardData(): Promise<DashboardData> {
  try {
    const supabase = await createClient();
    const [
      activeStudentsResult,
      activeEnrollmentsResult,
      classesResult,
      schedulesResult,
      activeEnrollmentsRowsResult,
      monthlyBase,
    ] = await Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("classes")
        .select("id, name, instructor_name, capacity")
        .eq("status", "active")
        .order("name", { ascending: true }),
      // `room` NÃO existe em `classes` — a sala é do HORÁRIO, porque a mesma
      // turma pode ocupar salas diferentes em dias diferentes. Pedir a coluna
      // no select de classes fazia a consulta inteira falhar, e o painel caía
      // no estado vazio: 0 alunos, 0 turmas, R$ 0, com 669 matrículas ativas
      // no banco.
      supabase.from("class_schedules").select("class_id, room"),
      supabase
        .from("enrollments")
        .select("id, class_id, monthly_amount")
        .eq("status", "active"),
      getMonthlyActiveBase(),
    ]);

    const errors = [
      activeStudentsResult.error,
      activeEnrollmentsResult.error,
      classesResult.error,
      schedulesResult.error,
      activeEnrollmentsRowsResult.error,
    ].filter(Boolean);

    if (errors[0]) {
      console.error("Dashboard load error:", errors[0].message);
      return emptyDashboard(errors[0].message);
    }

    const enrollmentRows = activeEnrollmentsRowsResult.data ?? [];

    const activeByClass = new Map<string, number>();
    let contractedMonthly = 0;

    for (const enrollment of enrollmentRows) {
      const classId = enrollment.class_id as string | null;
      if (classId) {
        activeByClass.set(classId, (activeByClass.get(classId) ?? 0) + 1);
      }
      contractedMonthly += Number(enrollment.monthly_amount ?? 0);
    }

    // Uma turma com dois horários em salas diferentes conta na primeira que
    // aparece — o bloco "Turmas por sala" é uma leitura de ocupação, não um
    // inventário; contar a mesma turma duas vezes inflaria o total.
    const salaPorTurma = new Map<string, string>();
    for (const horario of schedulesResult.data ?? []) {
      const classId = horario.class_id as string | null;
      const sala = (horario.room as string | null)?.trim();
      if (classId && sala && !salaPorTurma.has(classId)) {
        salaPorTurma.set(classId, sala);
      }
    }

    const classes: DashboardClass[] = (classesResult.data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) ?? "Turma sem nome",
      room: salaPorTurma.get(row.id as string) ?? null,
      instructorName: (row.instructor_name as string | null) ?? null,
      capacity: (row.capacity as number | null) ?? null,
      activeEnrollmentsCount: activeByClass.get(row.id as string) ?? 0,
    }));

    const countByKey = (key: string) =>
      classes.filter(
        (c) => getClassPerformanceStatus(c.activeEnrollmentsCount).key === key,
      ).length;

    const buckets: OccupancyBucket[] = [
      {
        key: "cti",
        label: "CTI",
        range: "0 a 5 alunos",
        count: countByKey("cti"),
        fill: "hsl(var(--danger))",
        text: "hsl(var(--danger-text))",
      },
      {
        key: "recovery",
        label: "Em recuperação",
        range: "6 a 10 alunos",
        count: countByKey("recovery"),
        fill: "hsl(var(--warning))",
        text: "hsl(var(--warning-text))",
      },
      {
        key: "high",
        label: "Em alta",
        range: "11 a 15 alunos",
        count: countByKey("high"),
        fill: "hsl(var(--success))",
        text: "hsl(var(--success-text))",
      },
      {
        key: "high_performance",
        label: "Alta performance",
        range: "16 ou mais",
        count: countByKey("high_performance"),
        fill: "hsl(var(--success-strong))",
        text: "hsl(var(--success-strong))",
      },
    ];

    // Fila acionável: as mais vazias primeiro, cortando em 6 para o bloco
    // caber sem rolagem. O link do rodapé leva ao resto.
    const needsAttention = classes
      .filter((c) => c.activeEnrollmentsCount <= 10)
      .sort((a, b) => a.activeEnrollmentsCount - b.activeEnrollmentsCount)
      .slice(0, 6);

    const roomCounts = new Map<string, number>();
    for (const danceClass of classes) {
      const room = danceClass.room?.trim();
      if (!room) continue;
      roomCounts.set(room, (roomCounts.get(room) ?? 0) + 1);
    }
    const classesByRoom = [...roomCounts.entries()]
      .map(([room, count]) => ({ room, count }))
      .sort((a, b) => b.count - a.count);

    // A série começa no primeiro mês de operação, então nos primeiros meses
    // ela é curta — o <Sparkline> se recusa a desenhar com menos de dois
    // pontos em vez de fingir uma tendência.
    const serie = monthlyBase.slice(-12);

    return {
      activeStudentsCount: activeStudentsResult.count ?? 0,
      activeEnrollmentsCount: activeEnrollmentsResult.count ?? 0,
      totalClassesCount: classes.length,
      contractedMonthly,
      buckets,
      needsAttention,
      classesByRoom,
      studentSeries: serie.map((point) => point.students),
      enrollmentSeries: serie.map((point) => point.enrollments),
      seriesLabel:
        serie.length >= 2
          ? `${serie[0].label} — ${serie[serie.length - 1].label}`
          : null,
      loadError: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao carregar o dashboard.";
    console.error("Dashboard load error:", message);
    return emptyDashboard(message);
  }
}

function emptyDashboard(loadError: string | null = null): DashboardData {
  return {
    activeStudentsCount: 0,
    activeEnrollmentsCount: 0,
    totalClassesCount: 0,
    contractedMonthly: 0,
    buckets: [],
    needsAttention: [],
    classesByRoom: [],
    studentSeries: [],
    enrollmentSeries: [],
    seriesLabel: null,
    loadError,
  };
}
