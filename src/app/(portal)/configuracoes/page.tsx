import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Preferências e parâmetros internos do portal."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/configuracoes/usuarios"
          className="rounded-md border border-border bg-white p-4 transition hover:border-primary"
        >
          <h2 className="text-lg font-semibold text-foreground">Usuários</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Gerencie acessos, perfis e status dos usuários do Portal DK.
          </p>
        </Link>
      </section>
    </div>
  );
}
