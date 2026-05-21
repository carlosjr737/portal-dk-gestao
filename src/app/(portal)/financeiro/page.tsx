import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

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
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Inadimplência
          </Link>
          <Link
            href="/financeiro/vinculos-conta-azul"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Vínculos Conta Azul
          </Link>
        </div>
      </section>
    </div>
  );
}
