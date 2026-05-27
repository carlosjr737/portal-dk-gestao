"use client";

import { useActionState, useState } from "react";
import type {
  FinanceProviderSettings,
  FinanceSettingsActionState,
} from "@/features/finance/conta-azul/finance-settings-actions";

type FinancialAccountOption = {
  id: string;
  nome: string;
};

type RevenueCategoryOption = {
  id: string;
  nome: string;
};

type ServiceOption = {
  id: string;
  descricao: string;
};

type FinanceSettingsFormProps = {
  action: (
    previousState: FinanceSettingsActionState,
    formData: FormData,
  ) => Promise<FinanceSettingsActionState>;
  settings: FinanceProviderSettings | null;
  financialAccounts: FinancialAccountOption[];
  revenueCategories: RevenueCategoryOption[];
  services: ServiceOption[];
};

const initialState: FinanceSettingsActionState = {};

export function FinanceSettingsForm({
  action,
  settings,
  financialAccounts,
  revenueCategories,
  services,
}: FinanceSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [selectedFinancialAccountId, setSelectedFinancialAccountId] = useState(
    settings?.conta_azul_financial_account_id ?? "",
  );
  const [selectedRevenueCategoryId, setSelectedRevenueCategoryId] = useState(
    settings?.conta_azul_revenue_category_id ?? "",
  );
  const [selectedServiceItemId, setSelectedServiceItemId] = useState(
    settings?.conta_azul_service_item_id ?? "",
  );
  const canEnableAutomaticReceivable =
    financialAccounts.length > 0 &&
    revenueCategories.length > 0 &&
    selectedFinancialAccountId.length > 0 &&
    selectedRevenueCategoryId.length > 0 &&
    selectedServiceItemId.length > 0;

  return (
    <form action={formAction} className="space-y-5">
      {state.message ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <Field
        label="Conta financeira Conta Azul"
        error={state.errors?.conta_azul_financial_account_id?.[0]}
      >
        <select
          name="conta_azul_financial_account_id"
          value={selectedFinancialAccountId}
          onChange={(event) => setSelectedFinancialAccountId(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
        >
          <option value="">Selecione uma conta</option>
          {financialAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Categoria de receita Conta Azul"
        error={state.errors?.conta_azul_revenue_category_id?.[0]}
      >
        <select
          name="conta_azul_revenue_category_id"
          value={selectedRevenueCategoryId}
          onChange={(event) => setSelectedRevenueCategoryId(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
        >
          <option value="">Selecione uma categoria</option>
          {revenueCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.nome}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Dia padrão de vencimento"
        error={state.errors?.default_due_day?.[0]}
      >
        <input
          type="number"
          name="default_due_day"
          min={1}
          max={31}
          defaultValue={settings?.default_due_day ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
      </Field>

      <div className="space-y-4 rounded-md border border-border bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Serviço padrão para contratos
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            O contrato recorrente usa este serviço como item do Conta Azul.
          </p>
        </div>

        <Field
          label="Serviço/Produto Conta Azul"
          error={state.errors?.conta_azul_service_item_id?.[0]}
        >
          <select
            value={selectedServiceItemId}
            onChange={(event) => setSelectedServiceItemId(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
          >
            <option value="">Selecione um serviço</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.descricao}
              </option>
            ))}
            {settings?.conta_azul_service_item_id &&
            !services.some(
              (service) => service.id === settings.conta_azul_service_item_id,
            ) ? (
              <option value={settings.conta_azul_service_item_id}>
                {settings.conta_azul_service_item_name ??
                  "Serviço configurado"}
              </option>
            ) : null}
          </select>
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="ID do serviço">
            <input
              type="text"
              name="conta_azul_service_item_id"
              value={selectedServiceItemId}
              onChange={(event) => setSelectedServiceItemId(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
            />
          </Field>

          <Field label="Nome do serviço">
            <input
              type="text"
              name="conta_azul_service_item_name"
              defaultValue={settings?.conta_azul_service_item_name ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="intent"
            value="search_service"
            disabled={isPending}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Buscar serviço Mensalidade
          </button>
          <button
            type="submit"
            name="intent"
            value="create_service"
            disabled={isPending}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Criar serviço Mensalidade DK Studio
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="auto_create_receivable_on_enrollment"
            defaultChecked={
              canEnableAutomaticReceivable &&
              (settings?.auto_create_receivable_on_enrollment ?? false)
            }
            disabled={!canEnableAutomaticReceivable}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          <span>Criar contrato automaticamente ao matricular?</span>
        </label>

        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            defaultChecked={settings?.active ?? false}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          <span>Integração ativa?</span>
        </label>
      </div>

      <button
        type="submit"
        name="intent"
        value="save"
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Salvando..." : "Salvar configurações"}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}
