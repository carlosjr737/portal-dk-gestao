import { PageHeader } from "@/components/layout/page-header";
import { getSchoolMetrics } from "@/features/school-metrics/queries";
import { getMonthlyActiveBase } from "@/features/school-metrics/monthly-base";
import { MonthlyBaseView } from "@/features/school-metrics/monthly-base-view";
import { SchoolMetricsView } from "@/features/school-metrics/school-metrics-view";

export const dynamic = "force-dynamic";

export default async function MetricasEscolaPage() {
  const [metrics, monthlyBase] = await Promise.all([
    getSchoolMetrics(),
    getMonthlyActiveBase(),
  ]);

  return (
    <div>
      <PageHeader
        title="Métricas da escola"
        description="Visão geral de matrículas, ocupação e receita de todo o DK Studio."
      />
      <div className="mt-6">
        <SchoolMetricsView metrics={metrics} />
      </div>
      <MonthlyBaseView points={monthlyBase} />
    </div>
  );
}
