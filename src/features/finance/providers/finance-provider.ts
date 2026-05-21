import "server-only";

export type FinanceCustomer = {
  externalId: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
};

export type OverdueReceivable = {
  externalId: string;
  customerExternalId?: string;
  customerName: string;
  customerDocument?: string;
  customerEmail?: string;
  description?: string;
  dueDate: string;
  amount: number;
  paidAmount?: number;
  openAmount: number;
  daysOverdue: number;
  status: string;
  source: string;
};

export type GetOverdueReceivablesParams = {
  fromDueDate?: string;
  toDueDate?: string;
  customerDocument?: string;
};

export type GetCustomersParams = {
  document?: string;
  search?: string;
};

export interface FinanceProvider {
  getProviderName(): string;
  getOverdueReceivables(
    params?: GetOverdueReceivablesParams,
  ): Promise<OverdueReceivable[]>;
  getCustomerByDocument(document: string): Promise<FinanceCustomer | null>;
  getCustomers(params?: GetCustomersParams): Promise<FinanceCustomer[]>;
}
