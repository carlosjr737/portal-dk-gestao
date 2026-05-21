import "server-only";

import type {
  FinanceCustomer,
  FinanceProvider,
  GetCustomersParams,
  GetOverdueReceivablesParams,
  OverdueReceivable,
} from "@/features/finance/providers/finance-provider";
import { ContaAzulProvider } from "@/features/finance/providers/conta-azul-provider";
import { MockFinanceProvider } from "@/features/finance/providers/mock-finance-provider";

class NoneFinanceProvider implements FinanceProvider {
  getProviderName() {
    return "none";
  }

  async getOverdueReceivables(
    _params: GetOverdueReceivablesParams = {},
  ): Promise<OverdueReceivable[]> {
    void _params;
    return [];
  }

  async getCustomerByDocument(
    _document: string,
  ): Promise<FinanceCustomer | null> {
    void _document;
    return null;
  }

  async getCustomers(_params: GetCustomersParams = {}): Promise<FinanceCustomer[]> {
    void _params;
    return [];
  }
}

export function getFinanceProvider(): FinanceProvider {
  const provider =
    process.env.FINANCE_PROVIDER ||
    (process.env.NODE_ENV === "development" ? "mock" : "none");

  if (provider === "mock") {
    return new MockFinanceProvider();
  }

  if (provider === "conta_azul") {
    return new ContaAzulProvider();
  }

  return new NoneFinanceProvider();
}
