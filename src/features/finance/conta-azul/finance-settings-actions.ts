"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ContaAzulClient } from "@/features/finance/conta-azul/client";
import type {
  ContaAzulEndpointDiagnostic,
  ContaAzulFinancialAccount,
  ContaAzulRevenueCategory,
  ContaAzulService,
} from "@/features/finance/conta-azul/types";
import { ensureContaAzulServiceItem } from "@/features/finance/conta-azul/enrollment-receivables";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";

const CONTA_AZUL_PROVIDER = "conta_azul";

export type FinanceProviderSettings = {
  provider: "conta_azul";
  conta_azul_financial_account_id: string | null;
  conta_azul_financial_account_name: string | null;
  conta_azul_revenue_category_id: string | null;
  conta_azul_revenue_category_name: string | null;
  conta_azul_service_item_id: string | null;
  conta_azul_service_item_name: string | null;
  default_due_day: number | null;
  auto_create_receivable_on_enrollment: boolean;
  active: boolean;
};

export type FinanceSettingsActionState = {
  message?: string;
  success?: boolean;
  errors?: Record<string, string[]>;
};

export async function getFinanceSettingsPageData() {
  const [settings, accountsResult, categoriesResult, servicesResult] =
    await Promise.all([
      getFinanceProviderSettings(),
      loadContaAzulFinancialAccounts(),
      loadContaAzulRevenueCategories(),
      loadContaAzulServices(),
    ]);

  return {
    settings,
    financialAccounts: accountsResult.items,
    revenueCategories: categoriesResult.items,
    services: servicesResult.items,
    loadError: accountsResult.error || categoriesResult.error,
    diagnostics: [...accountsResult.diagnostics, ...categoriesResult.diagnostics],
  };
}

export async function saveFinanceProviderSettingsAction(
  _previousState: FinanceSettingsActionState,
  formData: FormData,
): Promise<FinanceSettingsActionState> {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;

  if (!profile?.active || profile.role !== "admin") {
    return {
      success: false,
      message: "Acesso não autorizado.",
    };
  }

  const financialAccountId = getOptionalString(
    formData.get("conta_azul_financial_account_id"),
  );
  const revenueCategoryId = getOptionalString(
    formData.get("conta_azul_revenue_category_id"),
  );
  let serviceItemId = getOptionalString(
    formData.get("conta_azul_service_item_id"),
  );
  let serviceItemName = getOptionalString(
    formData.get("conta_azul_service_item_name"),
  );
  const defaultDueDay = parseDefaultDueDay(formData.get("default_due_day"));
  const autoCreateReceivable =
    formData.get("auto_create_receivable_on_enrollment") === "on";
  const active = formData.get("active") === "on";
  const intent = String(formData.get("intent") ?? "save");
  const errors: Record<string, string[]> = {};
  const missingAutoCreateConfig =
    "Selecione conta financeira, categoria de receita, serviço padrão e dia de vencimento antes de ativar a criação automática.";

  if (intent === "search_service") {
    const service = await findContaAzulMonthlyService();

    if (!service) {
      return {
        success: false,
        message: "Serviço Mensalidade DK Studio não encontrado no Conta Azul.",
      };
    }

    serviceItemId = service.id;
    serviceItemName = service.descricao;
  }

  if (intent === "create_service") {
    try {
      const serviceId = await ensureContaAzulServiceItem();
      const services = await new ContaAzulClient().listServices("Mensalidade");
      const service = services.find((item) => item.id === serviceId) ?? null;
      serviceItemId = serviceId;
      serviceItemName = service?.descricao ?? "Mensalidade DK Studio";
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar o serviço padrão no Conta Azul.",
      };
    }
  }

  if (defaultDueDay.invalid) {
    errors.default_due_day = ["Informe um dia entre 1 e 31."];
  }

  if (autoCreateReceivable) {
    if (!financialAccountId) {
      errors.conta_azul_financial_account_id = [missingAutoCreateConfig];
    }

    if (!revenueCategoryId) {
      errors.conta_azul_revenue_category_id = [missingAutoCreateConfig];
    }

    if (!serviceItemId) {
      errors.conta_azul_service_item_id = [missingAutoCreateConfig];
    }

    if (!defaultDueDay.value) {
      errors.default_due_day = [missingAutoCreateConfig];
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: autoCreateReceivable
        ? missingAutoCreateConfig
        : "Revise os campos destacados.",
      errors,
    };
  }

  const [accountsResult, categoriesResult, servicesResult] = await Promise.all([
    loadContaAzulFinancialAccounts(),
    loadContaAzulRevenueCategories(),
    loadContaAzulServices(),
  ]);
  const selectedAccount =
    accountsResult.items.find((account) => account.id === financialAccountId) ??
    null;
  const selectedCategory =
    categoriesResult.items.find((category) => category.id === revenueCategoryId) ??
    null;
  const listedService =
    servicesResult.items.find((service) => service.id === serviceItemId) ?? null;
  const selectedService = serviceItemId
    ? {
        id: serviceItemId,
        descricao:
          serviceItemName ?? listedService?.descricao ?? "Mensalidade DK Studio",
      }
    : null;

  if (autoCreateReceivable && (!selectedAccount || !selectedCategory || !selectedService)) {
    return {
      success: false,
      message: missingAutoCreateConfig,
      errors: {
        conta_azul_financial_account_id: !selectedAccount
          ? [missingAutoCreateConfig]
          : [],
        conta_azul_revenue_category_id: !selectedCategory
          ? [missingAutoCreateConfig]
          : [],
        conta_azul_service_item_id: !selectedService
          ? [missingAutoCreateConfig]
          : [],
      },
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("finance_provider_settings").upsert(
    {
      provider: CONTA_AZUL_PROVIDER,
      conta_azul_financial_account_id: financialAccountId,
      conta_azul_financial_account_name: selectedAccount?.nome ?? null,
      conta_azul_revenue_category_id: revenueCategoryId,
      conta_azul_revenue_category_name: selectedCategory?.nome ?? null,
      conta_azul_service_item_id: serviceItemId,
      conta_azul_service_item_name:
        selectedService?.descricao ?? serviceItemName ?? null,
      default_due_day: defaultDueDay.value,
      auto_create_receivable_on_enrollment: autoCreateReceivable,
      active,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "provider",
    },
  );

  if (error) {
    return {
      success: false,
      message: `Não foi possível salvar as configurações: ${error.message}`,
    };
  }

  revalidatePath("/financeiro/configuracoes");

  return {
    success: true,
    message: "Configurações financeiras salvas.",
  };
}

async function getFinanceProviderSettings(): Promise<FinanceProviderSettings | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("finance_provider_settings")
    .select(
      "provider, conta_azul_financial_account_id, conta_azul_financial_account_name, conta_azul_revenue_category_id, conta_azul_revenue_category_name, conta_azul_service_item_id, conta_azul_service_item_name, default_due_day, auto_create_receivable_on_enrollment, active",
    )
    .eq("provider", CONTA_AZUL_PROVIDER)
    .maybeSingle();

  if (error) {
    console.error("Finance provider settings load error:", error.message);
    return null;
  }

  return (data as FinanceProviderSettings | null) ?? null;
}

async function loadContaAzulFinancialAccounts(): Promise<{
  items: ContaAzulFinancialAccount[];
  error: boolean;
  diagnostics: ContaAzulEndpointDiagnostic[];
}> {
  let result;

  try {
    result = await new ContaAzulClient().listFinancialAccountsWithDiagnostics();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";

    console.error("Conta Azul financial accounts diagnostic failed:", {
      message,
    });

    return {
      items: [],
      error: true,
      diagnostics: [
        {
          label: "listFinancialAccounts",
          endpoint: "/v1/conta-financeira?apenas_ativo=true",
          status: null,
          ok: false,
          message,
          itemCount: 0,
          used: false,
          fallback: false,
        },
      ],
    };
  }

  if (result.items.length === 0) {
    console.error("Conta Azul financial accounts load error:", {
      diagnostics: result.diagnostics,
    });
  }

  return {
    items: result.items,
    error: result.items.length === 0,
    diagnostics: result.diagnostics,
  };
}

async function loadContaAzulRevenueCategories(): Promise<{
  items: ContaAzulRevenueCategory[];
  error: boolean;
  diagnostics: ContaAzulEndpointDiagnostic[];
}> {
  let result;

  try {
    result = await new ContaAzulClient().listRevenueCategoriesWithDiagnostics();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";

    console.error("Conta Azul revenue categories diagnostic failed:", {
      message,
    });

    return {
      items: [],
      error: true,
      diagnostics: [
        {
          label: "listRevenueCategories",
          endpoint:
            "/v1/categorias?tipo=RECEITA&pagina=1&tamanho_pagina=100&permite_apenas_filhos=true",
          status: null,
          ok: false,
          message,
          itemCount: 0,
          used: false,
          fallback: false,
        },
      ],
    };
  }

  if (result.items.length === 0) {
    console.error("Conta Azul revenue categories load error:", {
      diagnostics: result.diagnostics,
    });
  }

  return {
    items: result.items,
    error: result.items.length === 0,
    diagnostics: result.diagnostics,
  };
}

async function loadContaAzulServices(): Promise<{
  items: ContaAzulService[];
  error: boolean;
}> {
  try {
    const items = await new ContaAzulClient().listServices("Mensalidade");

    return {
      items,
      error: false,
    };
  } catch (error) {
    console.error("Conta Azul services load error:", {
      message: error instanceof Error ? error.message : error,
    });

    return {
      items: [],
      error: true,
    };
  }
}

async function findContaAzulMonthlyService() {
  const services = await new ContaAzulClient().listServices("Mensalidade");

  return (
    services.find(
      (service) =>
        service.status === "ATIVO" &&
        normalizeText(service.descricao).includes("mensalidade dk studio"),
    ) ??
    services.find(
      (service) =>
        service.status === "ATIVO" &&
        normalizeText(service.descricao).includes("mensalidade"),
    ) ??
    null
  );
}

function getOptionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function parseDefaultDueDay(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return {
      value: null,
      invalid: false,
    };
  }

  const numberValue = Number(text);
  const invalid =
    !Number.isInteger(numberValue) || numberValue < 1 || numberValue > 31;

  return {
    value: invalid ? null : numberValue,
    invalid,
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
