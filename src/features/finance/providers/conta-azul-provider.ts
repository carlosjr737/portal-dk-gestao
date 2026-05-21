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

type PersonEnrichment = {
  peopleById: Map<string, ContaAzulPerson>;
  lookupErrorIds: Set<string>;
};

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
    const receivableStatus = getContaAzulReceivableStatus();
    const receivables = await client.searchOverdueReceivables(
      buildContaAzulOverdueReceivablesFilters(params, receivableStatus),
    );
    const customerIds = getUniqueCustomerIds(receivables);

    console.info("Conta Azul receivable customer ids:", {
      customerIds,
      customerIdsCount: customerIds.length,
    });

    const { peopleById, lookupErrorIds } = await this.enrichPeopleForReceivables(
      receivables,
      customerIds,
      client,
    );
    const overdueReceivables: OverdueReceivable[] = [];

    for (const receivable of receivables.filter((item) =>
      isContaAzulOverdueReceivable(item, receivableStatus),
    )) {
      const person = receivable.cliente?.id
        ? peopleById.get(receivable.cliente.id) ?? null
        : null;

      overdueReceivables.push(
        mapContaAzulReceivableToOverdueReceivable(
          receivable,
          person,
          getCustomerDocumentStatus(receivable, person, lookupErrorIds),
        ),
      );
    }

    console.info("Conta Azul overdue receivables loaded:", {
      status: receivableStatus,
      receivables: receivables.length,
      customerIds,
      uniqueCustomerIds: customerIds.length,
      mappedReceivables: overdueReceivables.length,
      enrichedWithDocument: overdueReceivables.filter((receivable) =>
        Boolean(normalizeDocument(receivable.customerDocument)),
      ).length,
    });

    return overdueReceivables.filter((receivable) =>
      params.customerDocument
        ? normalizeDocument(receivable.customerDocument) ===
          normalizeDocument(params.customerDocument)
        : true,
    );
  }

  async getCustomerByDocument(_document: string): Promise<FinanceCustomer | null> {
    const document = normalizeDocument(_document);
    const { byDocument } = await this.buildContaAzulCustomerMaps({ document });

    return byDocument.get(document) ?? null;
  }

  async getCustomers(params: GetCustomersParams = {}): Promise<FinanceCustomer[]> {
    const people = await this.getClient().searchPeople({
      document: params.document,
      onlyIndividuals: params.onlyIndividuals,
      pageSize: 1000,
    });
    const customers = people.map(mapContaAzulPersonToFinanceCustomer);

    console.info("Conta Azul customers loaded:", {
      customers: customers.length,
      withDocument: customers.filter((customer) =>
        Boolean(normalizeDocument(customer.document)),
      ).length,
    });

    return customers.filter((customer) =>
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

  private async enrichPeopleForReceivables(
    receivables: ContaAzulReceivable[],
    ids: string[],
    client: ContaAzulClient,
  ): Promise<PersonEnrichment> {
    const peopleById = new Map<string, ContaAzulPerson>();
    const lookupErrorIds = new Set<string>();
    const namesById = buildCustomerNamesById(receivables);
    let fetchedPeopleCount = 0;
    let detailFetchedPeopleCount = 0;
    let textualFallbackPeopleCount = 0;
    const batchSize = 100;

    if (ids.length === 0) {
      console.info("Conta Azul people enrichment loaded:", {
        requestedIds: 0,
        fetchedPeople: 0,
        withDocument: 0,
      });

      return { peopleById, lookupErrorIds };
    }

    try {
      for (let index = 0; index < ids.length; index += batchSize) {
        const batchIds = ids.slice(index, index + batchSize);
        console.info("Conta Azul people ids request:", {
          url: "/v1/pessoas",
          queryParams: {
            tipo_perfil: "Cliente",
            ids: batchIds.join(","),
            pagina: 1,
            tamanho_pagina: 1000,
          },
        });
        const people = await client.searchPeople({
          ids: batchIds,
          pageSize: 1000,
          maxPages: 1,
        });

        fetchedPeopleCount += people.length;

        for (const person of people) {
          peopleById.set(person.id, person);
        }
      }
    } catch (error) {
      console.warn("Conta Azul people batch enrichment failed:", {
        error: error instanceof Error ? error.message : error,
      });
      for (const id of ids) {
        lookupErrorIds.add(id);
      }
    }

    detailFetchedPeopleCount = await this.enrichMissingPeopleWithDetails(
      ids,
      client,
      peopleById,
      lookupErrorIds,
    );
    textualFallbackPeopleCount = await this.enrichMissingPeopleWithSearch(
      ids,
      namesById,
      client,
      peopleById,
      lookupErrorIds,
    );

    console.info("Conta Azul people enrichment loaded:", {
      requestedIds: ids.length,
      fetchedPeopleByIds: fetchedPeopleCount,
      fetchedPeopleByDetails: detailFetchedPeopleCount,
      fetchedPeopleByTextualFallback: textualFallbackPeopleCount,
      withDocument: [...peopleById.values()].filter((person) =>
        Boolean(normalizeDocument(person.documento)),
      ).length,
    });

    return { peopleById, lookupErrorIds };
  }

  private async enrichMissingPeopleWithDetails(
    ids: string[],
    client: ContaAzulClient,
    peopleById: Map<string, ContaAzulPerson>,
    lookupErrorIds: Set<string>,
  ) {
    let fetchedPeopleCount = 0;

    for (const id of ids) {
      const currentPerson = peopleById.get(id);

      if (currentPerson && normalizeDocument(currentPerson.documento)) {
        continue;
      }

      try {
        const person = await client.getPersonById(id);
        peopleById.set(id, person);
        lookupErrorIds.delete(id);
        fetchedPeopleCount += 1;
      } catch (error) {
        lookupErrorIds.add(id);
        console.warn("Conta Azul person detail enrichment failed:", {
          personId: id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return fetchedPeopleCount;
  }

  private async enrichMissingPeopleWithSearch(
    ids: string[],
    namesById: Map<string, string>,
    client: ContaAzulClient,
    peopleById: Map<string, ContaAzulPerson>,
    lookupErrorIds: Set<string>,
  ) {
    let fetchedPeopleCount = 0;

    for (const id of ids) {
      const currentPerson = peopleById.get(id);

      if (currentPerson && normalizeDocument(currentPerson.documento)) {
        continue;
      }

      const name = namesById.get(id);

      if (!name) {
        continue;
      }

      try {
        const people = await client.searchPeople({
          search: name,
          pageSize: 10,
          maxPages: 1,
        });
        fetchedPeopleCount += people.length;
        const matchedPerson =
          people.find((person) => person.id === id) ??
          people.find((person) => normalizeText(person.nome) === normalizeText(name));

        if (matchedPerson) {
          peopleById.set(id, matchedPerson);
          lookupErrorIds.delete(id);
        }

        console.info("Conta Azul people textual fallback loaded:", {
          personId: id,
          returnedPeople: people.length,
          matched: Boolean(matchedPerson),
          matchedWithDocument: Boolean(normalizeDocument(matchedPerson?.documento)),
        });
      } catch (error) {
        lookupErrorIds.add(id);
        console.warn("Conta Azul people textual fallback failed:", {
          personId: id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return fetchedPeopleCount;
  }

  // Future option: call GET /v1/pessoas/{id} when atrasos_recebimentos
  // and recebimentos_mes_atual are needed per customer.
  private async buildContaAzulCustomerMaps(params: GetCustomersParams = {}) {
    const customers = await this.getCustomers(params);
    return buildContaAzulCustomerMaps(customers);
  }
}

function mapContaAzulReceivableToOverdueReceivable(
  receivable: ContaAzulReceivable,
  person: ContaAzulPerson | null,
  customerDocumentStatus: OverdueReceivable["customerDocumentStatus"],
): OverdueReceivable {
  return {
    externalId: receivable.id,
    customerExternalId: receivable.cliente?.id,
    customerName: receivable.cliente?.nome || person?.nome || "Cliente não informado",
    customerDocument: person?.documento,
    customerDocumentStatus,
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

function getCustomerDocumentStatus(
  receivable: ContaAzulReceivable,
  person: ContaAzulPerson | null,
  lookupErrorIds: Set<string>,
): OverdueReceivable["customerDocumentStatus"] {
  const customerId = receivable.cliente?.id;

  if (!customerId) {
    return "missing_customer_id";
  }

  if (lookupErrorIds.has(customerId)) {
    return "lookup_error";
  }

  if (normalizeDocument(person?.documento)) {
    return "found";
  }

  return "missing";
}

function buildContaAzulOverdueReceivablesFilters(
  params: GetOverdueReceivablesParams,
  status: string,
) {
  return {
    status,
    fromDueDate: params.fromDueDate,
    toDueDate: params.toDueDate,
  };
}

function getContaAzulReceivableStatus() {
  return process.env.CONTA_AZUL_RECEIVABLE_STATUS || "ATRASADO";
}

function mapContaAzulPersonToFinanceCustomer(
  person: ContaAzulPerson,
): FinanceCustomer {
  return {
    externalId: person.id,
    name: person.nome,
    document: person.documento,
    email: person.email,
    source: "conta_azul",
  };
}

function buildContaAzulCustomerMaps(customers: FinanceCustomer[]) {
  const byExternalId = new Map<string, FinanceCustomer>();
  const byDocument = new Map<string, FinanceCustomer>();

  for (const customer of customers) {
    byExternalId.set(customer.externalId, customer);

    const document = normalizeDocument(customer.document);

    if (document) {
      byDocument.set(document, customer);
    }
  }

  return { byExternalId, byDocument };
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

function isContaAzulOverdueReceivable(
  receivable: ContaAzulReceivable,
  configuredStatus: string,
) {
  return (
    receivable.status === configuredStatus ||
    receivable.status === "ATRASADO" ||
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

function buildCustomerNamesById(receivables: ContaAzulReceivable[]) {
  const namesById = new Map<string, string>();

  for (const receivable of receivables) {
    const customerId = receivable.cliente?.id;
    const customerName = receivable.cliente?.nome;

    if (customerId && customerName && !namesById.has(customerId)) {
      namesById.set(customerId, customerName);
    }
  }

  return namesById;
}
