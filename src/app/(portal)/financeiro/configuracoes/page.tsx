import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  getFinanceSettingsPageData,
  saveFinanceProviderSettingsAction,
} from "@/features/finance/conta-azul/finance-settings-actions";
import { FinanceSettingsForm } from "@/features/finance/conta-azul/finance-settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesFinanceirasPage() {
  const data = await getFinanceSettingsPageData();

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Configurações financeiras"
          description="Defina a conta financeira, categoria de receita e automação de contas a receber no Conta Azul."
        />
        <Link
          href="/financeiro"
          className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          Voltar
        </Link>
      </div>

      {data.loadError ? (
        <section className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Não foi possível carregar contas/categorias do Conta Azul. Verifique
            conexão, token e permissões.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.diagnostics.map((diagnostic) => (
              <div
                key={`${diagnostic.label}-${diagnostic.endpoint}`}
                className="rounded-md border border-amber-200 bg-white p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">
                    {diagnostic.label === "listFinancialAccounts"
                      ? "Contas financeiras"
                      : "Categorias"}
                    {diagnostic.fallback ? " (fallback)" : ""}
                  </p>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {diagnostic.used ? "Usado" : "Tentativa"}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-muted-foreground">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide">
                      Endpoint
                    </dt>
                    <dd className="mt-0.5 break-all font-mono text-xs">
                      {diagnostic.endpoint}
                    </dd>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide">
                        Status
                      </dt>
                      <dd className="mt-0.5 text-foreground">
                        {diagnostic.status ?? "-"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide">
                        Itens
                      </dt>
                      <dd className="mt-0.5 text-foreground">
                        {diagnostic.itemCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide">
                        OK
                      </dt>
                      <dd className="mt-0.5 text-foreground">
                        {diagnostic.ok ? "Sim" : "Não"}
                      </dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide">
                      Erro
                    </dt>
                    <dd className="mt-0.5 text-foreground">
                      {diagnostic.message}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-foreground">
            Conta Azul
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estas configurações controlam a criação automática de contas a receber
            quando uma matrícula é criada.
          </p>
        </div>

        <FinanceSettingsForm
          action={saveFinanceProviderSettingsAction}
          settings={data.settings}
          financialAccounts={data.financialAccounts}
          revenueCategories={data.revenueCategories}
        />
      </section>
    </div>
  );
}
