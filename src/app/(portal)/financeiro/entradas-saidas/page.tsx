import { PageHeader } from "@/components/layout/page-header";
import { EntradasSaidasDashboard } from "@/features/entradas-saidas/dashboard-view";

export const dynamic = "force-dynamic";

export default function EntradasSaidasPage() {
  return (
    <div>
      <PageHeader
        title="Entradas & Saídas"
        description="Histórico mensal de alunos, matrículas, crescimento e churn desde 2023."
      />
      <div className="mt-6">
        <EntradasSaidasDashboard />
      </div>
    </div>
  );
}
