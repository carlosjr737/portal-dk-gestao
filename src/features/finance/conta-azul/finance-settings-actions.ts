"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ContaAzulClient } from "@/features/finance/conta-azul/client";
import type {
  ContaAzulFinancialAccount,
  ContaAzulRevenueCategory,
} from "@/features/finance/conta-azul/types";
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
  const [settings, accountsResult, categoriesResult] = await Promise.all([
    getFinanceProviderSettings(),
    loadContaAzulFinancialAccounts(),
    loadContaAzulRevenueCategories(),
  ]);

  return {
    settings,
    financialAccounts: accountsResult.items,
    revenueCategories: categoriesResult.items,
    loadError: accountsResult.error || categoriesResult.error,
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
  const defaultDueDay = parseDefaultDueDay(formData.get("default_due_day"));
  const autoCreateReceivable =
    formData.get("auto_create_receivable_on_enrollment") === "on";
  const active = formData.get("active") === "on";
  const errors: Record<string, string[]> = {};

  if (defaultDueDay.invalid) {
    errors.default_due_day = ["Informe um dia entre 1 e 31."];
  }

  if (active || autoCreateReceivable) {
    if (!financialAccountId) {
      errors.conta_azul_financial_account_id = [
        "Selecione uma conta financeira.",
      ];
    }

    if (!revenueCategoryId) {
      errors.conta_azul_revenue_category_id = [
        "Selecione uma categoria de receita.",
      ];
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: "Revise os campos destacados.",
      errors,
    };
  }

  const [accountsResult, categoriesResult] = await Promise.all([
    loadContaAzulFinancialAccounts(),
    loadContaAzulRevenueCategories(),
  ]);
  const selectedAccount =
    accountsResult.items.find((account) => account.id === financialAccountId) ??
    null;
  const selectedCategory =
    categoriesResult.items.find((category) => category.id === revenueCategoryId) ??
    null;
  const supabase = createAdminClient();
  const { error } = await supabase.from("finance_provider_settings").upsert(
    {
      provider: CONTA_AZUL_PROVIDER,
      conta_azul_financial_account_id: financialAccountId,
      conta_azul_financial_account_name: selectedAccount?.nome ?? null,
      conta_azul_revenue_category_id: revenueCategoryId,
      conta_azul_revenue_category_name: selectedCategory?.nome ?? null,
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
      "provider, conta_azul_financial_account_id, conta_azul_financial_account_name, conta_azul_revenue_category_id, conta_azul_revenue_category_name, default_due_day, auto_create_receivable_on_enrollment, active",
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
}> {
  try {
    return {
      items: await new ContaAzulClient().listFinancialAccounts(),
      error: false,
    };
  } catch (error) {
    console.error("Conta Azul financial accounts load error:", {
      message: error instanceof Error ? error.message : error,
    });

    return {
      items: [],
      error: true,
    };
  }
}

async function loadContaAzulRevenueCategories(): Promise<{
  items: ContaAzulRevenueCategory[];
  error: boolean;
}> {
  try {
    return {
      items: await new ContaAzulClient().listRevenueCategories(),
      error: false,
    };
  } catch (error) {
    console.error("Conta Azul revenue categories load error:", {
      message: error instanceof Error ? error.message : error,
    });

    return {
      items: [],
      error: true,
    };
  }
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
