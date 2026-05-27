import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ContaAzulProvider } from "@/features/finance/providers/conta-azul-provider";
import type { FinanceCustomer } from "@/features/finance/providers/finance-provider";

export type ContaAzulGuardianLinkRow = {
  customer: FinanceCustomer;
  normalizedCustomerDocument: string;
  matchedGuardian: PortalGuardian | null;
  status:
    | "linked"
    | "matched_by_document"
    | "missing_customer_document"
    | "document_not_found"
    | "ambiguous";
};

export type PortalGuardian = {
  id: string;
  fullName: string;
  document: string | null;
  contaAzulPersonId: string | null;
};

export type ContaAzulGuardianLinkData = {
  customers: FinanceCustomer[];
  guardians: PortalGuardian[];
  rows: ContaAzulGuardianLinkRow[];
  metrics: {
    totalCustomers: number;
    customersWithDocument: number;
    guardiansWithDocument: number;
    matchedByDocument: number;
    customersWithoutLink: number;
    guardiansWithoutLink: number;
  };
};

export async function getContaAzulGuardianLinkData() {
  const [customers, guardians] = await Promise.all([
    new ContaAzulProvider().getCustomers(),
    getPortalGuardians(),
  ]);
  const guardiansByContaAzulId = new Map(
    guardians
      .filter((guardian) => Boolean(guardian.contaAzulPersonId))
      .map((guardian) => [guardian.contaAzulPersonId as string, guardian]),
  );
  const guardiansByDocument = buildGuardiansByDocument(guardians);
  const customersByDocument = buildCustomersByDocument(customers);
  const rows = customers.map((customer) =>
    buildLinkRow(
      customer,
      guardiansByContaAzulId,
      guardiansByDocument,
      customersByDocument,
    ),
  );
  const linkedGuardianIds = new Set(
    rows
      .map((row) => row.matchedGuardian?.id)
      .filter((id): id is string => Boolean(id)),
  );

  return {
    customers,
    guardians,
    rows,
    metrics: {
      totalCustomers: customers.length,
      customersWithDocument: customers.filter((customer) =>
        Boolean(normalizeDocument(customer.document)),
      ).length,
      guardiansWithDocument: guardians.filter((guardian) =>
        Boolean(normalizeDocument(guardian.document)),
      ).length,
      matchedByDocument: rows.filter((row) => row.status === "matched_by_document")
        .length,
      customersWithoutLink: rows.filter((row) => row.status !== "linked").length,
      guardiansWithoutLink: guardians.filter(
        (guardian) => !linkedGuardianIds.has(guardian.id),
      ).length,
    },
  };
}

export async function confirmContaAzulGuardianLink(
  guardianId: string,
  contaAzulPersonId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("guardians")
    .update({
      conta_azul_person_id: contaAzulPersonId,
      conta_azul_last_sync_at: new Date().toISOString(),
    })
    .eq("id", guardianId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function confirmSafeContaAzulGuardianLinks() {
  const data = await getContaAzulGuardianLinkData();
  const safeRows = data.rows.filter(
    (row) => row.status === "matched_by_document" && row.matchedGuardian,
  );

  for (const row of safeRows) {
    await confirmContaAzulGuardianLink(
      row.matchedGuardian!.id,
      row.customer.externalId,
    );
  }

  return safeRows.length;
}

export async function ensureContaAzulCustomerForGuardian(guardianId: string) {
  const supabase = await createClient();
  const { data: guardian, error } = await supabase
    .from("guardians")
    .select("id, full_name, document, phone, email, conta_azul_person_id")
    .eq("id", guardianId)
    .single();

  if (error || !guardian) {
    throw new Error(error?.message ?? "Responsável não encontrado.");
  }

  const existingPersonId = guardian.conta_azul_person_id as string | null;

  if (existingPersonId) {
    return existingPersonId;
  }

  const document = (guardian.document as string | null) ?? null;
  const normalizedDocument = normalizeDocument(document);

  if (!normalizedDocument) {
    throw new Error(
      "Responsável financeiro sem CPF para criar cliente no Conta Azul.",
    );
  }

  const provider = new ContaAzulProvider();
  const customer = await provider.getCustomerByDocument(normalizedDocument);

  if (customer) {
    await confirmContaAzulGuardianLink(guardianId, customer.externalId);
    return customer.externalId;
  }

  try {
    const createdCustomer = await provider.createCustomer({
      name: guardian.full_name as string,
      document: normalizedDocument,
      email: (guardian.email as string | null) ?? null,
      phone: (guardian.phone as string | null) ?? null,
    });

    await confirmContaAzulGuardianLink(guardianId, createdCustomer.externalId);
    console.info("Cliente Conta Azul criado e vinculado.", {
      guardianId,
      contaAzulPersonId: createdCustomer.externalId,
      document: maskDocument(normalizedDocument),
    });

    return createdCustomer.externalId;
  } catch (error) {
    console.error("Conta Azul customer creation failed:", {
      guardianId,
      document: maskDocument(normalizedDocument),
      message: error instanceof Error ? error.message : error,
    });
    throw new Error(
      `Não foi possível criar cliente no Conta Azul: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`,
    );
  }
}

export function normalizeDocument(value: string | null | undefined) {
  return value?.replace(/[\s./-]/g, "").replace(/\D/g, "") ?? "";
}

function maskDocument(value: string) {
  const normalized = normalizeDocument(value);

  if (normalized.length <= 4) {
    return "****";
  }

  return `${"*".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

async function getPortalGuardians(): Promise<PortalGuardian[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guardians")
    .select("id, full_name, document, conta_azul_person_id")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Conta Azul guardian link guardians load error:", error);
    return [];
  }

  return (data ?? []).map((guardian) => ({
    id: guardian.id as string,
    fullName: guardian.full_name as string,
    document: (guardian.document as string | null) ?? null,
    contaAzulPersonId:
      (guardian.conta_azul_person_id as string | null | undefined) ?? null,
  }));
}

function buildGuardiansByDocument(guardians: PortalGuardian[]) {
  const guardiansByDocument = new Map<string, PortalGuardian[]>();

  for (const guardian of guardians) {
    const document = normalizeDocument(guardian.document);

    if (!document) {
      continue;
    }

    guardiansByDocument.set(document, [
      ...(guardiansByDocument.get(document) ?? []),
      guardian,
    ]);
  }

  return guardiansByDocument;
}

function buildLinkRow(
  customer: FinanceCustomer,
  guardiansByContaAzulId: Map<string, PortalGuardian>,
  guardiansByDocument: Map<string, PortalGuardian[]>,
  customersByDocument: Map<string, FinanceCustomer[]>,
): ContaAzulGuardianLinkRow {
  const linkedGuardian = guardiansByContaAzulId.get(customer.externalId) ?? null;
  const normalizedCustomerDocument = normalizeDocument(customer.document);

  if (linkedGuardian) {
    return {
      customer,
      normalizedCustomerDocument,
      matchedGuardian: linkedGuardian,
      status: "linked",
    };
  }

  if (!normalizedCustomerDocument) {
    return {
      customer,
      normalizedCustomerDocument,
      matchedGuardian: null,
      status: "missing_customer_document",
    };
  }

  const guardians = guardiansByDocument.get(normalizedCustomerDocument) ?? [];
  const customersWithSameDocument =
    customersByDocument.get(normalizedCustomerDocument) ?? [];

  if (customersWithSameDocument.length > 1 || guardians.length > 1) {
    return {
      customer,
      normalizedCustomerDocument,
      matchedGuardian: guardians[0] ?? null,
      status: "ambiguous",
    };
  }

  if (guardians.length === 1) {
    const guardian = guardians[0];

    if (guardian.contaAzulPersonId && guardian.contaAzulPersonId !== customer.externalId) {
      return {
        customer,
        normalizedCustomerDocument,
        matchedGuardian: guardian,
        status: "ambiguous",
      };
    }

    return {
      customer,
      normalizedCustomerDocument,
      matchedGuardian: guardian,
      status: "matched_by_document",
    };
  }

  return {
    customer,
    normalizedCustomerDocument,
    matchedGuardian: guardians[0] ?? null,
    status: "document_not_found",
  };
}

function buildCustomersByDocument(customers: FinanceCustomer[]) {
  const customersByDocument = new Map<string, FinanceCustomer[]>();

  for (const customer of customers) {
    const document = normalizeDocument(customer.document);

    if (!document) {
      continue;
    }

    customersByDocument.set(document, [
      ...(customersByDocument.get(document) ?? []),
      customer,
    ]);
  }

  return customersByDocument;
}
