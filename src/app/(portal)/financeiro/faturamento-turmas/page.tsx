import { PageHeader } from "@/components/layout/page-header";
import { getSchoolMetrics } from "@/features/school-metrics/queries";
import { ClassRevenueView } from "@/features/class-revenue/class-revenue-view";

export const dynamic = "force-dynamic";

export default async function FaturamentoTurmasPage() {
  const metrics = await getSchoolMetrics();

  return (
    <div>
      <PageHeader
        title="Faturamento por turma"
        description="Mensalidade líquida gerada por cada turma ativa."
      />
      <div className="mt-6">
        <ClassRevenueView classes={metrics.classRevenue} />
      </div>
    </div>
  );
}
