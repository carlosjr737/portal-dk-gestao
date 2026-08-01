import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";

export default function FinanceiroPage() {
  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Área reservada para evoluções financeiras."
      />

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">
          Operações financeiras
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulte informações financeiras vindas do provider configurado.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/financeiro/inadimplencia"
            className={buttonVariants()}
          >
            Inadimplência
          </Link>
          <Link
            href="/financeiro/growth-churn"
            className={buttonVariants({ variant: "outline" })}
          >
            Growth & Churn
          </Link>
          <Link
            href="/financeiro/configuracoes"
            className={buttonVariants({ variant: "outline" })}
          >
            Configurações financeiras
          </Link>
        </div>
      </section>
    </div>
  );
}
