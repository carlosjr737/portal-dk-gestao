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
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Não foi possível carregar contas financeiras/categorias do Conta Azul.
        </div>
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
