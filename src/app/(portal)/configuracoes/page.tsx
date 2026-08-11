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
            Gerencie acessos, perfis e status dos usuários do sistema.
          </p>
        </Link>

        <Link
          href="/configuracoes/comunicacao"
          className="rounded-md border border-border bg-white p-4 transition hover:border-primary"
        >
          <h2 className="text-lg font-semibold text-foreground">Comunicação</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ajuste o texto dos e-mails que o sistema manda sozinho.
          </p>
        </Link>

        <Link
          href="/configuracoes/permissoes"
          className="rounded-md border border-border bg-white p-4 transition hover:border-primary"
        >
          <h2 className="text-lg font-semibold text-foreground">Permissões</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Escolha o que cada função enxerga no sistema.
          </p>
        </Link>
      </section>
    </div>
  );
}
