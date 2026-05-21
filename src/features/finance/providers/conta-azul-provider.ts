import "server-only";

import type {
  FinanceCustomer,
  FinanceProvider,
  GetCustomersParams,
  GetOverdueReceivablesParams,
  OverdueReceivable,
} from "@/features/finance/providers/finance-provider";
import { ContaAzulClient } from "@/features/finance/conta-azul/client";
import type {
  ContaAzulPerson,
  ContaAzulReceivable,
} from "@/features/finance/conta-azul/types";

export class ContaAzulProvider implements FinanceProvider {
  private readonly client?: ContaAzulClient;

  constructor(client?: ContaAzulClient) {
    this.client = client;
  }

  getProviderName() {
    return "conta_azul";
  }

  async getOverdueReceivables(
    params: GetOverdueReceivablesParams = {},
  ): Promise<OverdueReceivable[]> {
    const client = this.getClient();
    const receivables = await client.searchOverdueReceivables({
      fromDueDate: params.fromDueDate,
      toDueDate: params.toDueDate,
    });
    const peopleById = await this.getPeopleByIds(
      getUniqueCustomerIds(receivables),
      client,
    );
    const overdueReceivables: OverdueReceivable[] = [];

    for (const receivable of receivables.filter(isContaAzulOverdueReceivable)) {
      const person = receivable.cliente?.id
        ? peopleById.get(receivable.cliente.id) ?? null
        : null;

      overdueReceivables.push(
        mapContaAzulReceivableToOverdueReceivable(receivable, person),
      );
    }

    return overdueReceivables.filter((receivable) =>
      params.customerDocument
        ? normalizeDocument(receivable.customerDocument) ===
          normalizeDocument(params.customerDocument)
        : true,
    );
  }

  async getCustomerByDocument(_document: string): Promise<FinanceCustomer | null> {
    const document = normalizeDocument(_document);
    const customers = await this.getCustomers({ document });

    return (
      customers.find(
        (customer) => normalizeDocument(customer.document) === document,
      ) ?? null
    );
  }

  async getCustomers(params: GetCustomersParams = {}): Promise<FinanceCustomer[]> {
    const people = await this.getClient().searchPeople({
      document: params.document,
    });

    return people
      .map(mapContaAzulPersonToFinanceCustomer)
      .filter((customer) =>
        params.document
          ? normalizeDocument(customer.document) === normalizeDocument(params.document)
          : params.search
            ? normalizeText(customer.name).includes(normalizeText(params.search))
            : true,
      );
  }

  private getClient() {
    return this.client ?? new ContaAzulClient();
  }

  private async getPeopleByIds(
    ids: string[],
    client: ContaAzulClient,
  ): Promise<Map<string, ContaAzulPerson>> {
    const peopleById = new Map<string, ContaAzulPerson>();
    const batchSize = 100;

    if (ids.length === 0) {
      return peopleById;
    }

    try {
      for (let index = 0; index < ids.length; index += batchSize) {
        const batchIds = ids.slice(index, index + batchSize);
        const people = await client.searchPeople({
          ids: batchIds,
          pageSize: 1000,
          maxPages: 1,
        });

        for (const person of people) {
          peopleById.set(person.id, person);
        }
      }
    } catch (error) {
      console.warn("Conta Azul people batch enrichment failed:", {
        error: error instanceof Error ? error.message : error,
      });
    }

    return peopleById;
  }
}

function mapContaAzulReceivableToOverdueReceivable(
  receivable: ContaAzulReceivable,
  person: ContaAzulPerson | null,
): OverdueReceivable {
  return {
    externalId: receivable.id,
    customerExternalId: receivable.cliente?.id,
    customerName: receivable.cliente?.nome || person?.nome || "Cliente não informado",
    customerDocument: person?.documento,
    customerEmail: person?.email,
    description: receivable.descricao,
    dueDate: receivable.data_vencimento,
    amount: receivable.total,
    paidAmount: receivable.pago ?? 0,
    openAmount: receivable.nao_pago,
    daysOverdue: calculateDaysOverdue(receivable.data_vencimento),
    status: receivable.status,
    source: "conta_azul",
  };
}

function mapContaAzulPersonToFinanceCustomer(
  person: ContaAzulPerson,
): FinanceCustomer {
  return {
    externalId: person.id,
    name: person.nome,
    document: person.documento,
    email: person.email,
  };
}

function calculateDaysOverdue(dueDate: string) {
  if (!dueDate) {
    return 0;
  }

  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(due.getTime())) {
    return 0;
  }

  const diffMs = today.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function normalizeDocument(value: string | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeText(value: string | undefined) {
  return (
    value
      ?.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toUpperCase() ?? ""
  );
}

function isContaAzulOverdueReceivable(receivable: ContaAzulReceivable) {
  return (
    receivable.status === "OVERDUE" ||
    receivable.status_traduzido === "ATRASADO"
  );
}

function getUniqueCustomerIds(receivables: ContaAzulReceivable[]) {
  return [
    ...new Set(
      receivables
        .map((receivable) => receivable.cliente?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}
