import { PageHeader } from "@/components/layout/page-header";
import { getSchoolMetrics } from "@/features/school-metrics/queries";
import { getMonthlyActiveBase } from "@/features/school-metrics/monthly-base";
import { MonthlyBaseView } from "@/features/school-metrics/monthly-base-view";
import { SchoolMetricsView } from "@/features/school-metrics/school-metrics-view";
import { getCurrentEscolaId } from "@/features/auth/session";
import { EvolucaoMensal } from "@/features/metricas/evolucao";

export const dynamic = "force-dynamic";

export default async function MetricasEscolaPage() {
  const [metrics, monthlyBase, escolaId] = await Promise.all([
    getSchoolMetrics(),
    getMonthlyActiveBase(),
    getCurrentEscolaId(),
  ]);

  return (
    <div>
      <PageHeader
        title="Métricas da escola"
        description="Visão geral de matrículas, ocupação e receita da escola."
      />
      <div className="mt-6">
        <SchoolMetricsView metrics={metrics} monthlyBase={monthlyBase} />
      </div>
      <MonthlyBaseView points={monthlyBase} />

      <div className="mt-8">
        <EvolucaoMensal escolaId={escolaId} />
      </div>
    </div>
  );
}
