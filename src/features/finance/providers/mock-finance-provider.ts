import "server-only";

import type {
  FinanceCustomer,
  FinanceProvider,
  GetCustomersParams,
  GetOverdueReceivablesParams,
  OverdueReceivable,
} from "@/features/finance/providers/finance-provider";

const mockCustomers: FinanceCustomer[] = [
  {
    externalId: "mock-customer-1",
    name: "Marina Costa",
    document: "12345678900",
    email: "marina.costa@example.com",
    phone: "(11) 99999-0000",
  },
  {
    externalId: "mock-customer-2",
    name: "Carlos Almeida",
    document: "98765432100",
    email: "carlos.almeida@example.com",
    phone: "(21) 98888-1111",
  },
];

const mockOverdueReceivables: OverdueReceivable[] = [
  {
    externalId: "mock-receivable-1",
    customerExternalId: "mock-customer-1",
    customerName: "Marina Costa",
    customerDocument: "12345678900",
    description: "Mensalidade Danças Urbanas",
    dueDate: "2026-05-10",
    amount: 350,
    paidAmount: 0,
    openAmount: 350,
    daysOverdue: 10,
    status: "overdue",
    source: "mock",
  },
  {
    externalId: "mock-receivable-2",
    customerExternalId: "mock-customer-2",
    customerName: "Carlos Almeida",
    customerDocument: "98765432100",
    description: "Mensalidade Jazz",
    dueDate: "2026-04-15",
    amount: 420,
    paidAmount: 100,
    openAmount: 320,
    daysOverdue: 35,
    status: "overdue",
    source: "mock",
  },
];

export class MockFinanceProvider implements FinanceProvider {
  getProviderName() {
    return "mock";
  }

  async getOverdueReceivables(params: GetOverdueReceivablesParams = {}) {
    return mockOverdueReceivables.filter((receivable) => {
      if (
        params.customerDocument &&
        receivable.customerDocument !== params.customerDocument
      ) {
        return false;
      }

      if (params.fromDueDate && receivable.dueDate < params.fromDueDate) {
        return false;
      }

      if (params.toDueDate && receivable.dueDate > params.toDueDate) {
        return false;
      }

      return true;
    });
  }

  async getCustomerByDocument(document: string) {
    return (
      mockCustomers.find((customer) => customer.document === document) ?? null
    );
  }

  async getCustomers(params: GetCustomersParams = {}) {
    return mockCustomers.filter((customer) => {
      if (params.document && customer.document !== params.document) {
        return false;
      }

      if (params.search) {
        const search = params.search.toLocaleLowerCase("pt-BR");

        return [customer.name, customer.document, customer.email, customer.phone]
          .filter(Boolean)
          .some((value) =>
            value?.toLocaleLowerCase("pt-BR").includes(search),
          );
      }

      return true;
    });
  }
}
