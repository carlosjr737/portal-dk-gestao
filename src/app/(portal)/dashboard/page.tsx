import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  formatCapacity,
  formatClassSchedules,
} from "@/features/classes/formatters";
import { formatDateTime, formatText } from "@/features/students/formatters";
import { getClassPerformanceStatus } from "@/lib/class-performance";
import type { ClassStatus } from "@/features/classes/schemas";
import type { ClassSchedule } from "@/features/classes/types";

export const dynamic = "force-dynamic";

type EnrollmentRow = {
  id: string;
  status: string;
  created_at: string;
  student: {
    id: string;
    full_name: string;
  } | null;
  class: {
    id: string;
    name: string;
  } | null;
};

type DashboardData = {
  activeStudentsCount: number;
  activeEnrollmentsCount: number;
  totalClassesCount: number;
  ctiClasses: DashboardClass[];
  recoveryClasses: DashboardClass[];
  highClasses: DashboardClass[];
  highPerformanceClasses: DashboardClass[];
  studentsWithoutGuardianCount: number;
  studentsWithoutFinancialGuardianCount: number;
  enrollmentsWithoutFinancialGuardianCount: number;
  studentsWithoutActiveEnrollmentCount: number;
  latestEnrollments: EnrollmentRow[];
  loadError: string | null;
};

type DashboardClass = {
  id: string;
  name: string;
  category: string | null;
  instructor_name: string | null;
  capacity: number | null;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
  active_enrollments_count: number;
  schedules: ClassSchedule[];
  occupancyLabel: string;
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

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Alunos ativos" value={data.activeStudentsCount} />
        <MetricCard
          label="Matrículas ativas"
          value={data.activeEnrollmentsCount}
        />
        <MetricCard label="Total de turmas" value={data.totalClassesCount} />
        <MetricCard
          label="Alunos sem responsável"
          value={data.studentsWithoutGuardianCount}
          tone={data.studentsWithoutGuardianCount > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Alunos sem resp. financeiro"
          value={data.studentsWithoutFinancialGuardianCount}
          tone={
            data.studentsWithoutFinancialGuardianCount > 0
              ? "warning"
              : "default"
          }
        />
        <MetricCard
          label="Matrículas sem resp. financeiro"
          value={data.enrollmentsWithoutFinancialGuardianCount}
          tone={
            data.enrollmentsWithoutFinancialGuardianCount > 0
              ? "warning"
              : "default"
          }
        />
        <MetricCard
          label="Alunos sem matrícula ativa"
          value={data.studentsWithoutActiveEnrollmentCount}
          tone={
            data.studentsWithoutActiveEnrollmentCount > 0 ? "warning" : "default"
          }
        />
        <MetricCard
          label="Turmas no CTI"
          value={data.ctiClasses.length}
          tone={data.ctiClasses.length > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Turmas em recuperação"
          value={data.recoveryClasses.length}
          tone="warning"
        />
        <MetricCard
          label="Turmas em alta"
          value={data.highClasses.length}
          tone="success"
        />
        <MetricCard
          label="Alta performance"
          value={data.highPerformanceClasses.length}
          tone="success"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
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

        <Panel title="Turmas em recuperação">
          <ClassList
            classes={data.recoveryClasses}
            emptyText="Nenhuma turma em recuperação."
          />
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="Turmas no CTI">
          <ClassList classes={data.ctiClasses} emptyText="Nenhuma turma no CTI." />
        </Panel>

        <Panel title="Últimas matrículas">
          <div className="divide-y divide-border">
            {data.latestEnrollments.length > 0 ? (
              data.latestEnrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link
                      href={`/alunos/${enrollment.student?.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {enrollment.student?.full_name ?? "Aluno não encontrado"}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {enrollment.class?.name ?? "Turma não encontrada"}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(enrollment.created_at)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma matrícula encontrada.
              </p>
            )}
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
      schedulesResult,
      activeEnrollmentsRowsResult,
      studentsResult,
      guardianLinksResult,
      enrollmentsWithoutFinancialGuardianResult,
      latestEnrollmentsResult,
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
        .select(
          "id, name, category, instructor_name, capacity, status, created_at, updated_at",
        )
        .eq("status", "active")
        .order("name", { ascending: true }),
      supabase
        .from("class_schedules")
        .select("id, class_id, weekday, start_time, end_time, room, created_at, updated_at"),
      supabase
        .from("enrollments")
        .select("id, student_id, class_id")
        .eq("status", "active"),
      supabase.from("students").select("id, status"),
      supabase
        .from("student_guardians")
        .select("student_id, is_financial_responsible"),
      supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .is("financial_guardian_id", null),
      supabase
        .from("enrollments")
        .select(
          "id, status, created_at, student:students(id, full_name), class:classes(id, name)",
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const errors = [
      activeStudentsResult.error,
      activeEnrollmentsResult.error,
      totalClassesResult.error,
      classesResult.error,
      schedulesResult.error,
      activeEnrollmentsRowsResult.error,
      studentsResult.error,
      guardianLinksResult.error,
      enrollmentsWithoutFinancialGuardianResult.error,
      latestEnrollmentsResult.error,
    ].filter(Boolean);

    if (errors[0]) {
      console.error("Dashboard load error:", errors[0].message);
      return getEmptyDashboardData(errors[0].message);
    }

    const activeEnrollmentsByClass = new Map<string, number>();
    const schedulesByClass = new Map<string, ClassSchedule[]>();
    const studentsWithActiveEnrollment = new Set<string>();

    for (const enrollment of activeEnrollmentsRowsResult.data ?? []) {
      const classId = enrollment.class_id as string | null;
      const studentId = enrollment.student_id as string | null;

      if (classId) {
        activeEnrollmentsByClass.set(
          classId,
          (activeEnrollmentsByClass.get(classId) ?? 0) + 1,
        );
      }

      if (studentId) {
        studentsWithActiveEnrollment.add(studentId);
      }
    }

    for (const schedule of (schedulesResult.data ?? []) as ClassSchedule[]) {
      const currentSchedules = schedulesByClass.get(schedule.class_id) ?? [];
      schedulesByClass.set(schedule.class_id, [...currentSchedules, schedule]);
    }

    const studentsWithGuardian = new Set<string>();
    const studentsWithFinancialGuardian = new Set<string>();

    for (const link of guardianLinksResult.data ?? []) {
      const studentId = link.student_id as string | null;

      if (studentId) {
        studentsWithGuardian.add(studentId);

        if (link.is_financial_responsible === true) {
          studentsWithFinancialGuardian.add(studentId);
        }
      }
    }

    const allStudents = studentsResult.data ?? [];
    const studentsWithoutGuardianCount = allStudents.filter(
      (student) => !studentsWithGuardian.has(student.id as string),
    ).length;
    const studentsWithoutFinancialGuardianCount = allStudents.filter(
      (student) =>
        student.status === "active" &&
        !studentsWithFinancialGuardian.has(student.id as string),
    ).length;
    const studentsWithoutActiveEnrollmentCount = allStudents.filter(
      (student) =>
        student.status === "active" &&
        !studentsWithActiveEnrollment.has(student.id as string),
    ).length;

    const dashboardClasses = ((classesResult.data ?? []) as DashboardClass[]).map(
      (danceClass) => {
        const activeEnrollmentsCount =
          activeEnrollmentsByClass.get(danceClass.id) ?? 0;
        const occupancyRate =
          danceClass.capacity && danceClass.capacity > 0
            ? activeEnrollmentsCount / danceClass.capacity
            : null;

        return {
          ...danceClass,
          active_enrollments_count: activeEnrollmentsCount,
          schedules: schedulesByClass.get(danceClass.id) ?? [],
          occupancyLabel:
            occupancyRate === null ? "-" : `${Math.round(occupancyRate * 100)}%`,
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
      studentsWithoutGuardianCount,
      studentsWithoutFinancialGuardianCount,
      enrollmentsWithoutFinancialGuardianCount:
        enrollmentsWithoutFinancialGuardianResult.count ?? 0,
      studentsWithoutActiveEnrollmentCount,
      latestEnrollments: normalizeLatestEnrollments(latestEnrollmentsResult.data),
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
    studentsWithoutGuardianCount: 0,
    studentsWithoutFinancialGuardianCount: 0,
    enrollmentsWithoutFinancialGuardianCount: 0,
    studentsWithoutActiveEnrollmentCount: 0,
    latestEnrollments: [],
    loadError,
  };
}

function normalizeLatestEnrollments(data: unknown): EnrollmentRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item) => {
    const row = item as {
      id?: unknown;
      status?: unknown;
      created_at?: unknown;
      student?: unknown;
      class?: unknown;
    };

    return {
      id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
      status: typeof row.status === "string" ? row.status : "active",
      created_at:
        typeof row.created_at === "string"
          ? row.created_at
          : new Date(0).toISOString(),
      student: normalizeStudentRelation(row.student),
      class: normalizeClassRelation(row.class),
    };
  });
}

function normalizeStudentRelation(
  value: unknown,
): { id: string; full_name: string } | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  const relation = value as {
    id?: unknown;
    full_name?: unknown;
  };

  if (
    typeof relation.id !== "string" ||
    typeof relation.full_name !== "string"
  ) {
    return null;
  }

  return {
    id: relation.id,
    full_name: relation.full_name,
  };
}

function normalizeClassRelation(
  value: unknown,
): { id: string; name: string } | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  const relation = value as {
    id?: unknown;
    name?: unknown;
  };

  if (typeof relation.id !== "string" || typeof relation.name !== "string") {
    return null;
  }

  return {
    id: relation.id,
    name: relation.name,
  };
}

type MetricCardProps = {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger";
};

function MetricCard({ label, value, tone = "default" }: MetricCardProps) {
  const toneClass = {
    default: "border-border bg-white",
    success: "border-emerald-200 bg-emerald-50",
    warning: "border-amber-200 bg-amber-50",
    danger: "border-rose-200 bg-rose-50",
  }[tone];

  return (
    <div className={`rounded-md border p-5 ${toneClass}`}>
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

type ClassListProps = {
  classes: DashboardClass[];
  emptyText: string;
};

const performanceToneClasses = {
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  premium: "border-violet-200 bg-violet-50 text-violet-700",
};

function ClassList({ classes, emptyText }: ClassListProps) {
  if (classes.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="divide-y divide-border">
      {classes.slice(0, 8).map((danceClass) => (
        <ClassListItem key={danceClass.id} danceClass={danceClass} />
      ))}
    </div>
  );
}

function ClassListItem({ danceClass }: { danceClass: DashboardClass }) {
  const performance = getClassPerformanceStatus(
    danceClass.active_enrollments_count,
  );

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link
          href={`/turmas/${danceClass.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {danceClass.name}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatText(danceClass.category)} ·{" "}
          {formatClassSchedules(danceClass.schedules)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
            performanceToneClasses[performance.tone]
          }`}
        >
          {performance.label}
        </span>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {danceClass.active_enrollments_count} /{" "}
          {formatCapacity(danceClass.capacity)}
        </span>
        <span className="rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-foreground">
          {danceClass.occupancyLabel}
        </span>
      </div>
    </div>
  );
}
