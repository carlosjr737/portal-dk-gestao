import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { getClassPerformanceStatus } from "@/lib/class-performance";

export const dynamic = "force-dynamic";

type DashboardData = {
  activeStudentsCount: number;
  activeEnrollmentsCount: number;
  totalClassesCount: number;
  ctiClasses: DashboardClass[];
  recoveryClasses: DashboardClass[];
  highClasses: DashboardClass[];
  highPerformanceClasses: DashboardClass[];
  loadError: string | null;
};

type DashboardClass = {
  id: string;
  active_enrollments_count: number;
};

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral de ocupação e indicadores operacionais do DK Studio."
      />

      {data.loadError ? (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Não foi possível carregar alguns dados do dashboard. Os indicadores
          foram exibidos zerados para manter a página disponível.
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Alunos ativos" value={data.activeStudentsCount} />
        <MetricCard
          label="Matrículas ativas"
          value={data.activeEnrollmentsCount}
        />
        <MetricCard label="Total de turmas" value={data.totalClassesCount} />
      </section>

      <section className="mt-6">
        <Panel title="Performance das turmas">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusSummary
              title="CTI"
              description="0 a 5 alunos ativos"
              value={data.ctiClasses.length}
              tone="danger"
            />
            <StatusSummary
              title="Em recuperação"
              description="6 a 10 alunos ativos"
              value={data.recoveryClasses.length}
              tone="warning"
            />
            <StatusSummary
              title="Em alta"
              description="11 a 15 alunos ativos"
              value={data.highClasses.length}
              tone="success"
            />
            <StatusSummary
              title="Alta performance"
              description="16 ou mais alunos ativos"
              value={data.highPerformanceClasses.length}
              tone="premium"
            />
          </div>
        </Panel>
      </section>
    </div>
  );
}

async function getDashboardData(): Promise<DashboardData> {
  try {
    const supabase = await createClient();
    const [
      activeStudentsResult,
      activeEnrollmentsResult,
      totalClassesResult,
      classesResult,
      activeEnrollmentsRowsResult,
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
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("classes")
        .select("id")
        .eq("status", "active")
        .order("name", { ascending: true }),
      supabase
        .from("enrollments")
        .select("id, student_id, class_id")
        .eq("status", "active"),
    ]);

    const errors = [
      activeStudentsResult.error,
      activeEnrollmentsResult.error,
      totalClassesResult.error,
      classesResult.error,
      activeEnrollmentsRowsResult.error,
    ].filter(Boolean);

    if (errors[0]) {
      console.error("Dashboard load error:", errors[0].message);
      return getEmptyDashboardData(errors[0].message);
    }

    const activeEnrollmentsByClass = new Map<string, number>();

    for (const enrollment of activeEnrollmentsRowsResult.data ?? []) {
      const classId = enrollment.class_id as string | null;

      if (classId) {
        activeEnrollmentsByClass.set(
          classId,
          (activeEnrollmentsByClass.get(classId) ?? 0) + 1,
        );
      }
    }

    const dashboardClasses = ((classesResult.data ?? []) as DashboardClass[]).map(
      (danceClass) => {
        const activeEnrollmentsCount =
          activeEnrollmentsByClass.get(danceClass.id) ?? 0;

        return {
          ...danceClass,
          active_enrollments_count: activeEnrollmentsCount,
        };
      },
    );

    const ctiClasses = dashboardClasses.filter(
      (danceClass) =>
        getClassPerformanceStatus(danceClass.active_enrollments_count).key ===
        "cti",
    );
    const recoveryClasses = dashboardClasses.filter(
      (danceClass) =>
        getClassPerformanceStatus(danceClass.active_enrollments_count).key ===
        "recovery",
    );
    const highClasses = dashboardClasses.filter(
      (danceClass) =>
        getClassPerformanceStatus(danceClass.active_enrollments_count).key ===
        "high",
    );
    const highPerformanceClasses = dashboardClasses.filter(
      (danceClass) =>
        getClassPerformanceStatus(danceClass.active_enrollments_count).key ===
        "high_performance",
    );

    return {
      activeStudentsCount: activeStudentsResult.count ?? 0,
      activeEnrollmentsCount: activeEnrollmentsResult.count ?? 0,
      totalClassesCount: totalClassesResult.count ?? 0,
      ctiClasses,
      recoveryClasses,
      highClasses,
      highPerformanceClasses,
      loadError: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao carregar o dashboard.";

    console.error("Dashboard load error:", message);
    return getEmptyDashboardData(message);
  }
}

function getEmptyDashboardData(loadError: string | null = null): DashboardData {
  return {
    activeStudentsCount: 0,
    activeEnrollmentsCount: 0,
    totalClassesCount: 0,
    ctiClasses: [],
    recoveryClasses: [],
    highClasses: [],
    highPerformanceClasses: [],
    loadError,
  };
}

type MetricCardProps = {
  label: string;
  value: number;
};

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-md border border-border bg-white p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

type PanelProps = {
  title: string;
  children: React.ReactNode;
};

function Panel({ title, children }: PanelProps) {
  return (
    <section className="rounded-md border border-border bg-white p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type StatusSummaryProps = {
  title: string;
  description: string;
  value: number;
  tone: "success" | "warning" | "danger" | "premium";
};

function StatusSummary({ title, description, value, tone }: StatusSummaryProps) {
  const toneClass = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    premium: "border-violet-200 bg-violet-50 text-violet-700",
  }[tone];

  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs opacity-80">{description}</p>
        </div>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}
