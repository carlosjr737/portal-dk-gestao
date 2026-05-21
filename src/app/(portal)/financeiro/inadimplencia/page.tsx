import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { getContaAzulTokens } from "@/features/finance/conta-azul/token-store";
import { getFinanceProvider } from "@/features/finance/providers/finance-provider-factory";
import type { OverdueReceivable } from "@/features/finance/providers/finance-provider";

export const dynamic = "force-dynamic";

type InadimplenciaPageProps = {
  searchParams?: Promise<{
    q?: string;
    minDaysOverdue?: string;
    fromDueDate?: string;
    toDueDate?: string;
    linkStatus?: string;
    connected?: string;
    connectionError?: string;
  }>;
};

type GuardianMatch = {
  id: string;
  fullName: string;
  document: string | null;
  students: string[];
  matchStatus: "linked_by_conta_azul_id" | "matched_by_document";
};

type OverdueReceivableWithMatch = OverdueReceivable & {
  portalGuardian: GuardianMatch | null;
};

export default async function InadimplenciaPage({
  searchParams,
}: InadimplenciaPageProps) {
  const params = await searchParams;
  const filters = {
    q: params?.q?.trim() ?? "",
    minDaysOverdue: params?.minDaysOverdue?.trim() ?? "",
    fromDueDate: params?.fromDueDate?.trim() ?? "",
    toDueDate: params?.toDueDate?.trim() ?? "",
    linkStatus:
      params?.linkStatus === "linked" || params?.linkStatus === "unlinked"
        ? params.linkStatus
        : "",
  };

  const data = await getInadimplenciaData(filters);
  const isContaAzulProvider = data.providerName === "conta_azul";
  const needsContaAzulConnection =
    isContaAzulProvider &&
    (!data.isConnected ||
      data.errorMessage === "CONTA_AZUL_ACCESS_TOKEN não configurado." ||
      data.errorMessage === "Conta Azul precisa ser reconectada.");

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Inadimplência"
          description="Acompanhe títulos vencidos vindos do provedor financeiro configurado."
        />
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Provider: {data.providerName}
          </span>
          {data.providerName === "mock" ? (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
              Dados simulados
            </span>
          ) : null}
          {isContaAzulProvider && data.isConnected ? (
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              Conta Azul conectada
            </span>
          ) : null}
          {data.contaAzulReceivableStatus &&
          data.contaAzulReceivableStatus !== "ATRASADO" ? (
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              Modo teste: {data.contaAzulReceivableStatus}
            </span>
          ) : null}
          {isContaAzulProvider ? (
            <a
              href="/api/integrations/conta-azul/connect"
              className="inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
            >
              {needsContaAzulConnection
                ? "Reconectar Conta Azul"
                : "Conectar Conta Azul"}
            </a>
          ) : null}
        </div>
      </div>

      {params?.connected === "conta_azul" ? (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Conta Azul conectada com sucesso.
        </div>
      ) : null}

      {params?.connectionError ? (
        <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {getConnectionErrorMessage(params.connectionError)}
        </div>
      ) : null}

      {data.providerName === "none" ? (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Nenhum provedor financeiro configurado.
        </div>
      ) : null}

      {data.errorMessage ? (
        <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {data.errorMessage}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total em atraso" value={formatMoney(data.totalOpenAmount)} />
        <MetricCard
          label="Títulos vencidos"
          value={String(data.receivables.length)}
        />
        <MetricCard
          label="Clientes inadimplentes"
          value={String(data.overdueCustomersCount)}
        />
        <MetricCard
          label="Vencimento mais antigo"
          value={data.oldestDueDate ? formatDate(data.oldestDueDate) : "-"}
        />
      </section>

      <form className="mt-6 grid gap-3 rounded-md border border-border bg-white p-4 md:grid-cols-[1.4fr_180px_180px_180px_180px_auto]">
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Buscar por nome/documento
          </span>
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Cliente, responsável, aluno ou CPF/CNPJ"
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Dias em atraso
          </span>
          <input
            name="minDaysOverdue"
            type="number"
            min="0"
            defaultValue={filters.minDaysOverdue}
            placeholder="Mínimo"
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Vencimento de
          </span>
          <input
            name="fromDueDate"
            type="date"
            defaultValue={filters.fromDueDate}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Vencimento até
          </span>
          <input
            name="toDueDate"
            type="date"
            defaultValue={filters.toDueDate}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Vínculo</span>
          <select
            name="linkStatus"
            defaultValue={filters.linkStatus}
            className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
          >
            <option value="">Todos</option>
            <option value="linked">Vinculados</option>
            <option value="unlinked">Não vinculados</option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Filtrar
          </button>
          <a
            href="/financeiro/inadimplencia"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Limpar
          </a>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Cliente Conta Azul</th>
                <th className="px-4 py-3 font-semibold">CPF/CNPJ</th>
                <th className="px-4 py-3 font-semibold">
                  Responsável no Portal DK
                </th>
                <th className="px-4 py-3 font-semibold">Alunos vinculados</th>
                <th className="px-4 py-3 font-semibold">Descrição</th>
                <th className="px-4 py-3 font-semibold">Vencimento</th>
                <th className="px-4 py-3 font-semibold">Dias em atraso</th>
                <th className="px-4 py-3 font-semibold">Valor em aberto</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.receivables.length > 0 ? (
                data.receivables.map((receivable) => (
                  <tr key={receivable.externalId} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {receivable.customerName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {getCustomerDocumentLabel(receivable)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {getPortalGuardianLabel(receivable)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {receivable.portalGuardian?.students.length
                        ? receivable.portalGuardian.students.join(", ")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {receivable.description || "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(receivable.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {receivable.daysOverdue}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {formatMoney(receivable.openAmount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {receivable.status}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    {getEmptyReceivablesMessage(data)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function getInadimplenciaData(filters: {
  q: string;
  minDaysOverdue: string;
  fromDueDate: string;
  toDueDate: string;
  linkStatus: string;
}) {
  const provider = getFinanceProvider();
  const providerName = provider.getProviderName();

  if (providerName === "none") {
    return buildData(providerName, [], null);
  }

  const isContaAzulProvider = providerName === "conta_azul";
  const contaAzulTokens = isContaAzulProvider
    ? await getSafeContaAzulTokens()
    : null;
  const isContaAzulConnected = Boolean(
    contaAzulTokens?.accessToken && contaAzulTokens.status === "connected",
  );
  const contaAzulReceivableStatus = isContaAzulProvider
    ? getContaAzulReceivableStatus()
    : null;

  try {
    const receivables = await provider.getOverdueReceivables({
      fromDueDate: filters.fromDueDate || undefined,
      toDueDate: filters.toDueDate || undefined,
    });

    if (isContaAzulProvider) {
      console.info("Finance Conta Azul receivables returned:", {
        totalReceivables: receivables.length,
      });
    }

    const guardiansByReceivable = await getGuardiansByReceivableLinks(receivables);
    const enrichedReceivables = receivables.map((receivable) => ({
      ...receivable,
      portalGuardian:
        guardiansByReceivable.get(receivable.externalId) ??
        null,
    }));

    console.info("Finance overdue guardian matching:", {
      overdueReceivables: receivables.length,
      withCustomerDocument: receivables.filter((receivable) =>
        Boolean(normalizeDocument(receivable.customerDocument)),
      ).length,
      linkedToGuardians: enrichedReceivables.filter(
        (receivable) => receivable.portalGuardian,
      ).length,
    });

    const filteredReceivables = filterReceivables(enrichedReceivables, filters);

    return buildData(
      providerName,
      filteredReceivables,
      null,
      isContaAzulConnected,
      contaAzulReceivableStatus,
    );
  } catch (error) {
    console.error("Finance overdue receivables load error:", error);
    const providerMessage = getFinanceProviderErrorMessage(error, providerName);

    return buildData(
      providerName,
      [],
      providerMessage,
      isContaAzulConnected,
      contaAzulReceivableStatus,
    );
  }
}

function getFinanceProviderErrorMessage(error: unknown, providerName: string) {
  if (!(error instanceof Error)) {
    return "Não foi possível carregar a inadimplência financeira.";
  }

  if (providerName === "conta_azul") {
    return error.message;
  }

  return "Não foi possível carregar a inadimplência financeira.";
}

async function getSafeContaAzulTokens() {
  try {
    return await getContaAzulTokens();
  } catch (error) {
    console.error(
      "Conta Azul token status load error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function getGuardiansByReceivableLinks(receivables: OverdueReceivable[]) {
  const customerExternalIds = [
    ...new Set(
      receivables
        .map((receivable) => receivable.customerExternalId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const uniqueDocuments = [
    ...new Set(
      receivables
        .map((receivable) => normalizeDocument(receivable.customerDocument))
        .filter(Boolean),
    ),
  ];

  if (customerExternalIds.length === 0 && uniqueDocuments.length === 0) {
    return new Map<string, GuardianMatch>();
  }

  const supabase = await createClient();
  const { data: guardians, error: guardiansError } = await supabase
    .from("guardians")
    .select("id, full_name, document, conta_azul_person_id");

  if (guardiansError) {
    console.error("Finance guardian matching load error:", guardiansError);
    return new Map<string, GuardianMatch>();
  }

  const guardiansWithContaAzulId = (guardians ?? []).filter((guardian) =>
    Boolean((guardian.conta_azul_person_id as string | null) ?? ""),
  );

  console.info("Finance Conta Azul linked guardians loaded:", {
    totalWithContaAzulPersonId: guardiansWithContaAzulId.length,
    sampleContaAzulPersonIds: guardiansWithContaAzulId
      .slice(0, 5)
      .map((guardian) => guardian.conta_azul_person_id as string),
    totalContaAzulReceivables: receivables.length,
  });

  const guardiansByContaAzulId = new Map(
    (guardians ?? [])
      .filter((guardian) =>
        customerExternalIds.includes(
          (guardian.conta_azul_person_id as string | null) ?? "",
        ),
      )
      .map((guardian) => [
        guardian.conta_azul_person_id as string,
        guardian,
      ]),
  );
  const guardiansByDocument = new Map<string, typeof guardians>();

  for (const guardian of guardians ?? []) {
    const document = normalizeDocument(guardian.document as string | null);

    if (!document || !uniqueDocuments.includes(document)) {
      continue;
    }

    guardiansByDocument.set(document, [
      ...(guardiansByDocument.get(document) ?? []),
      guardian,
    ]);
  }

  const matchingGuardians = [
    ...new Map(
      [
        ...guardiansByContaAzulId.values(),
        ...[...guardiansByDocument.values()].flat(),
      ].map((guardian) => [guardian.id as string, guardian]),
    ).values(),
  ];
  const guardianIds = matchingGuardians.map((guardian) => guardian.id as string);

  console.info("Finance guardians matched by document:", {
    requestedDocuments: uniqueDocuments.length,
    matchedGuardians: matchingGuardians.length,
    requestedContaAzulIds: customerExternalIds.length,
    matchedByContaAzulId: guardiansByContaAzulId.size,
  });

  if (guardianIds.length === 0) {
    return new Map<string, GuardianMatch>();
  }

  const [
    { data: links, error: linksError },
    { data: students, error: studentsError },
  ] = await Promise.all([
    supabase
      .from("student_guardians")
      .select("guardian_id, student_id")
      .in("guardian_id", guardianIds),
    supabase.from("students").select("id, full_name"),
  ]);

  if (linksError || studentsError) {
    console.error(
      "Finance guardian student matching load error:",
      linksError ?? studentsError,
    );
  }

  const studentsById = new Map(
    (students ?? []).map((student) => [
      student.id as string,
      student.full_name as string,
    ]),
  );
  const studentsByGuardianId = new Map<string, string[]>();

  for (const link of links ?? []) {
    const guardianId = link.guardian_id as string | null;
    const studentName = studentsById.get(link.student_id as string);

    if (!guardianId || !studentName) {
      continue;
    }

    const currentStudents = studentsByGuardianId.get(guardianId) ?? [];
    studentsByGuardianId.set(guardianId, [...currentStudents, studentName]);
  }

  const matchesByReceivableId = new Map<string, GuardianMatch>();

  for (const receivable of receivables) {
    const linkedGuardian = receivable.customerExternalId
      ? guardiansByContaAzulId.get(receivable.customerExternalId)
      : null;
    const document = normalizeDocument(receivable.customerDocument);
    const attemptedDocumentFallback = !linkedGuardian && Boolean(document);

    if (linkedGuardian) {
      const guardianMatch = mapGuardianMatch(
        linkedGuardian,
        studentsByGuardianId,
        "linked_by_conta_azul_id",
      );
      matchesByReceivableId.set(receivable.externalId, guardianMatch);
      logReceivableGuardianLinkDiagnostic(receivable, {
        foundByContaAzulId: true,
        attemptedDocumentFallback,
        result: guardianMatch.matchStatus,
      });
      continue;
    }

    const documentGuardians = document ? guardiansByDocument.get(document) ?? [] : [];

    if (documentGuardians.length === 1) {
      const guardianMatch = mapGuardianMatch(
        documentGuardians[0],
        studentsByGuardianId,
        "matched_by_document",
      );
      matchesByReceivableId.set(receivable.externalId, guardianMatch);
      logReceivableGuardianLinkDiagnostic(receivable, {
        foundByContaAzulId: false,
        attemptedDocumentFallback,
        result: guardianMatch.matchStatus,
      });
      continue;
    }

    logReceivableGuardianLinkDiagnostic(receivable, {
      foundByContaAzulId: false,
      attemptedDocumentFallback,
      result: "not_linked",
    });
  }

  return matchesByReceivableId;
}

function filterReceivables(
  receivables: OverdueReceivableWithMatch[],
  filters: {
    q: string;
    minDaysOverdue: string;
    fromDueDate: string;
    toDueDate: string;
    linkStatus: string;
  },
) {
  const normalizedSearch = filters.q.toLocaleLowerCase("pt-BR");
  const normalizedDocumentSearch = normalizeDocument(filters.q);
  const minDaysOverdue = filters.minDaysOverdue
    ? Number(filters.minDaysOverdue)
    : null;

  return receivables.filter((receivable) => {
    if (minDaysOverdue !== null && receivable.daysOverdue < minDaysOverdue) {
      return false;
    }

    if (filters.linkStatus === "linked" && !receivable.portalGuardian) {
      return false;
    }

    if (filters.linkStatus === "unlinked" && receivable.portalGuardian) {
      return false;
    }

    if (normalizedSearch) {
      const textMatches = [
        receivable.customerName,
        receivable.customerDocument,
        receivable.description,
        receivable.portalGuardian?.fullName,
        ...(receivable.portalGuardian?.students ?? []),
      ]
        .filter(Boolean)
        .some((value) =>
          value?.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
        );
      const documentMatches =
        normalizedDocumentSearch &&
        normalizeDocument(receivable.customerDocument).includes(
          normalizedDocumentSearch,
        );

      if (!textMatches && !documentMatches) {
        return false;
      }
    }

    return true;
  });
}

function buildData(
  providerName: string,
  receivables: OverdueReceivableWithMatch[],
  errorMessage: string | null,
  isConnected = false,
  contaAzulReceivableStatus: string | null = null,
) {
  const totalOpenAmount = receivables.reduce(
    (total, receivable) => total + receivable.openAmount,
    0,
  );
  const overdueCustomerKeys = new Set(
    receivables.map((receivable) =>
      receivable.customerDocument
        ? normalizeDocument(receivable.customerDocument)
        : receivable.customerExternalId || receivable.externalId,
    ),
  );
  const oldestDueDate = receivables
    .map((receivable) => receivable.dueDate)
    .sort()[0];

  return {
    providerName,
    receivables,
    totalOpenAmount,
    overdueCustomersCount: overdueCustomerKeys.size,
    oldestDueDate,
    errorMessage,
    isConnected,
    contaAzulReceivableStatus,
  };
}

function getContaAzulReceivableStatus() {
  return process.env.CONTA_AZUL_RECEIVABLE_STATUS || "ATRASADO";
}

function getEmptyReceivablesMessage(data: {
  providerName: string;
  contaAzulReceivableStatus: string | null;
}) {
  if (data.providerName === "conta_azul" && data.contaAzulReceivableStatus) {
    return `Nenhum título encontrado para o status ${data.contaAzulReceivableStatus}.`;
  }

  return "Nenhum título vencido encontrado.";
}

function getCustomerDocumentLabel(receivable: OverdueReceivableWithMatch) {
  if (receivable.customerDocument) {
    return receivable.customerDocument;
  }

  if (receivable.customerDocumentStatus === "missing_customer_id") {
    return "Cliente sem ID";
  }

  if (receivable.customerDocumentStatus === "lookup_error") {
    return "Erro ao buscar documento";
  }

  return "Sem CPF/CNPJ no Conta Azul";
}

function getPortalGuardianLabel(receivable: OverdueReceivableWithMatch) {
  if (!receivable.portalGuardian) {
    return "Não vinculado";
  }

  if (receivable.portalGuardian.matchStatus === "matched_by_document") {
    return `${receivable.portalGuardian.fullName} (Encontrado por CPF, vínculo pendente)`;
  }

  return receivable.portalGuardian.fullName;
}

function mapGuardianMatch(
  guardian: {
    id: unknown;
    full_name: unknown;
    document?: unknown;
  },
  studentsByGuardianId: Map<string, string[]>,
  matchStatus: GuardianMatch["matchStatus"],
): GuardianMatch {
  const guardianId = guardian.id as string;

  return {
    id: guardianId,
    fullName: guardian.full_name as string,
    document: (guardian.document as string | null) ?? null,
    students: studentsByGuardianId.get(guardianId) ?? [],
    matchStatus,
  };
}

function logReceivableGuardianLinkDiagnostic(
  receivable: OverdueReceivable,
  diagnostic: {
    foundByContaAzulId: boolean;
    attemptedDocumentFallback: boolean;
    result:
      | GuardianMatch["matchStatus"]
      | "not_linked";
  },
) {
  console.info("Finance Conta Azul receivable guardian link:", {
    externalId: receivable.externalId,
    customerExternalId: receivable.customerExternalId ?? null,
    customerName: receivable.customerName,
    customerDocument: receivable.customerDocument ?? null,
    foundGuardianByContaAzulPersonId: diagnostic.foundByContaAzulId,
    attemptedDocumentFallback: diagnostic.attemptedDocumentFallback,
    finalLinkResult: diagnostic.result,
  });
}

function normalizeDocument(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function getConnectionErrorMessage(error: string) {
  const messages: Record<string, string> = {
    token_exchange_400:
      "Falha ao trocar código. Verifique redirect_uri e formato do body OAuth.",
    token_exchange_401: "Client ID ou Client Secret inválidos.",
    token_exchange_403:
      "A Conta Azul recusou a troca do token. Verifique permissões e configuração do app.",
    token_exchange_500:
      "A Conta Azul retornou erro interno durante a troca do token.",
    token_exchange_unknown: "Erro desconhecido na troca do token.",
    token_storage: "Token recebido, mas não foi possível salvar a conexão.",
    missing_code: "A Conta Azul não retornou o código de autorização.",
  };

  return (
    messages[error] ?? "Não foi possível concluir a conexão com a Conta Azul."
  );
}
