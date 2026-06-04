import { PageHeader } from "@/components/layout/page-header";
import { getSchoolMetrics } from "@/features/school-metrics/queries";
import { SchoolMetricsView } from "@/features/school-metrics/school-metrics-view";

export const dynamic = "force-dynamic";

export default async function MetricasEscolaPage() {
  const metrics = await getSchoolMetrics();

  return (
    <div>
      <PageHeader
        title="Métricas da escola"
        description="Visão geral de matrículas, ocupação e receita de todo o DK Studio."
      />
      <div className="mt-6">
        <SchoolMetricsView metrics={metrics} />
      </div>
    </div>
  );
}
