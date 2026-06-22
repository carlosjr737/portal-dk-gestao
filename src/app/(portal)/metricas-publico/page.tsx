import { PageHeader } from "@/components/layout/page-header";
import { getAudienceMetrics } from "@/features/audience-metrics/queries";
import { AudienceMetricsView } from "@/features/audience-metrics/audience-metrics-view";

export const dynamic = "force-dynamic";

export default async function MetricasPublicoPage() {
  const metrics = await getAudienceMetrics();

  return (
    <div>
      <PageHeader
        title="Métricas do público"
        description="Análise demográfica dos alunos: idade, modalidade, nível e crescimento."
      />
      <div className="mt-6">
        <AudienceMetricsView metrics={metrics} />
      </div>
    </div>
  );
}
