import "server-only";

export type FinanceCustomer = {
  externalId: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  source?: string;
};

export type OverdueReceivable = {
  externalId: string;
  customerExternalId?: string;
  customerName: string;
  customerDocument?: string;
  customerDocumentStatus?: "found" | "missing" | "lookup_error" | "missing_customer_id";
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
  onlyIndividuals?: boolean;
};

export interface FinanceProvider {
  getProviderName(): string;
  getOverdueReceivables(
    params?: GetOverdueReceivablesParams,
  ): Promise<OverdueReceivable[]>;
  getCustomerByDocument(document: string): Promise<FinanceCustomer | null>;
  getCustomers(params?: GetCustomersParams): Promise<FinanceCustomer[]>;
}
