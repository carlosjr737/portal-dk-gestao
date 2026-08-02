import { PageHeader } from "@/components/layout/page-header";
import { getAudienceMetrics } from "@/features/audience-metrics/queries";
import { getMonthlyActiveBase } from "@/features/school-metrics/monthly-base";
import { AudienceMetricsView } from "@/features/audience-metrics/audience-metrics-view";

export const dynamic = "force-dynamic";

export default async function MetricasPublicoPage() {
  const [metrics, monthlyBase] = await Promise.all([
    getAudienceMetrics(),
    getMonthlyActiveBase(),
  ]);

  return (
    <div>
      <PageHeader
        title="Métricas do público"
        description="Análise demográfica dos alunos: idade, modalidade e nível."
      />
      <div className="mt-6">
        <AudienceMetricsView metrics={metrics} monthlyBase={monthlyBase} />
      </div>
    </div>
  );
}
