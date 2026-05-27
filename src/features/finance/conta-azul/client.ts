import "server-only";

import type {
  ContaAzulCreateReceivableInput,
  ContaAzulCreateReceivablePayload,
  ContaAzulCreateReceivableResponse,
  ContaAzulFinancialAccount,
  ContaAzulPaginatedResponse,
  ContaAzulPerson,
  ContaAzulReceivable,
  ContaAzulRevenueCategory,
} from "@/features/finance/conta-azul/types";
import { refreshContaAzulAccessToken } from "@/features/finance/conta-azul/auth";
import { getContaAzulTokens } from "@/features/finance/conta-azul/token-store";

const DEFAULT_CONTA_AZUL_BASE_URL = "https://api-v2.contaazul.com";
const accessTokenNotConfiguredMessage =
  "CONTA_AZUL_ACCESS_TOKEN não configurado.";
const reconnectMessage = "Conta Azul precisa ser reconectada.";

type ContaAzulClientConfig = {
  baseUrl?: string;
  accessToken?: string;
};

type SearchReceivablesParams = {
  status?: string | string[];
  statusParamName?: "status" | "status[]";
  fromDueDate?: string;
  toDueDate?: string;
};

type SearchPeopleParams = {
  ids?: string[];
  document?: string;
  search?: string;
  onlyIndividuals?: boolean;
  pageSize?: number;
  maxPages?: number;
};

export class ContaAzulApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ContaAzulApiError";
  }
}

type ContaAzulQueryValue = string | number | string[] | undefined;
type ContaAzulQueryParams = Record<string, ContaAzulQueryValue>;

export class ContaAzulClient {
  private readonly baseUrl: string;
  private accessToken?: string;

  constructor(config: ContaAzulClientConfig = getContaAzulConfig()) {
    this.baseUrl = config.baseUrl ?? DEFAULT_CONTA_AZUL_BASE_URL;
    this.accessToken = config.accessToken;
  }

  async searchOverdueReceivables(params: SearchReceivablesParams = {}) {
    return this.getAllPages<ContaAzulReceivable>(
      "/v1/financeiro/eventos-financeiros/contas-a-receber/buscar",
      buildReceivablesQueryParams(params),
    );
  }

  async searchPeople(params: SearchPeopleParams = {}) {
    return this.getAllPages<ContaAzulPerson>(
      "/v1/pessoas",
      buildPeopleQueryParams(params),
      {
        pageSize: params.pageSize,
        maxPages: params.maxPages,
      },
    );
  }

  async getPersonById(id: string) {
    return this.get<ContaAzulPerson>(`/v1/pessoas/${encodeURIComponent(id)}`, {});
  }

  async listFinancialAccounts() {
    const body = await this.getJsonWithDebug(
      "/v1/financeiro/contas-financeiras",
      { apenas_ativo: "true" },
      "listFinancialAccounts",
    );

    return normalizeFinancialAccounts(body);
  }

  async listRevenueCategories() {
    try {
      const body = await this.getJsonWithDebug(
        "/v1/financeiro/categorias",
        {
          tipo: "RECEITA",
          apenas_filhos: "true",
        },
        "listRevenueCategories",
      );

      return normalizeRevenueCategories(body);
    } catch (error) {
      console.warn("Conta Azul revenue categories primary query failed:", {
        endpoint: "/v1/financeiro/categorias",
        queryParams: {
          tipo: "RECEITA",
          apenas_filhos: "true",
        },
        message: error instanceof Error ? error.message : error,
      });

      const fallbackBody = await this.getJsonWithDebug(
        "/v1/financeiro/categorias",
        {
          tipo: "RECEITA",
        },
        "listRevenueCategories",
      );

      return normalizeRevenueCategories(fallbackBody);
    }
  }

  async createReceivable(input: ContaAzulCreateReceivableInput) {
    return this.post<
      ContaAzulCreateReceivablePayload,
      ContaAzulCreateReceivableResponse
    >("/v1/financeiro/contas-a-receber", buildCreateReceivablePayload(input));
  }

  private async getAllPages<T>(
    path: string,
    query: ContaAzulQueryParams,
    options: { pageSize?: number; maxPages?: number } = {},
  ) {
    const pageSize = Math.min(options.pageSize ?? 100, 1000);
    const maxPages = options.maxPages ?? 100;
    const items: T[] = [];

    for (let page = 1; page <= maxPages; page += 1) {
      const response = await this.get<ContaAzulPaginatedResponse<T>>(path, {
        ...query,
        pagina: page,
        tamanho_pagina: pageSize,
      });
      const pageItems = response.itens ?? response.items ?? [];
      const totalItems =
        response.itens_totais ?? response.total_itens ?? response.totalItems;

      items.push(...pageItems);

      if (path.includes("/contas-a-receber/buscar")) {
        console.info("Conta Azul receivables page loaded:", {
          page,
          returnedItems: pageItems.length,
          totalItems,
        });
      }

      if (path === "/v1/pessoas") {
        console.info("Conta Azul people page loaded:", {
          page,
          returnedItems: pageItems.length,
          totalItems,
        });
      }

      if (pageItems.length < pageSize) {
        break;
      }

      if (typeof totalItems === "number" && items.length >= totalItems) {
        break;
      }
    }

    if (path.includes("/contas-a-receber/buscar")) {
      console.info("Conta Azul receivables search completed:", {
        returnedItems: items.length,
      });
    }

    return items;
  }

  private async get<T>(
    path: string,
    query: ContaAzulQueryParams,
    retryOnUnauthorized = true,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== "") {
            url.searchParams.append(key, item);
          }
        }
      } else if (value !== undefined && value !== "") {
        url.searchParams.append(key, String(value));
      }
    }

    this.logRequest(url, query);

    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    this.logResponse(url, query, response.status);

    if (response.status === 401) {
      const responseText = await response.text();
      this.logFailedRequest(url, query, response.status, responseText, reconnectMessage);

      if (!retryOnUnauthorized) {
        throw new ContaAzulApiError(reconnectMessage, response.status);
      }

      try {
        this.accessToken = await refreshContaAzulAccessToken();
      } catch (error) {
        console.error(
          "Conta Azul token refresh failed after unauthorized response:",
          error instanceof Error ? error.message : error,
        );
        throw new ContaAzulApiError(reconnectMessage, response.status);
      }

      return this.get<T>(path, query, false);
    }

    if (!response.ok) {
      const responseText = await response.text();
      const message = getErrorMessage(response.status, responseText);

      this.logFailedRequest(url, query, response.status, responseText, message);

      throw new ContaAzulApiError(message, response.status);
    }

    return (await response.json()) as T;
  }

  private async post<TPayload, TResponse>(
    path: string,
    payload: TPayload,
    retryOnUnauthorized = true,
  ): Promise<TResponse> {
    const url = new URL(path, this.baseUrl);

    this.logRequest(url, {});

    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    this.logResponse(url, {}, response.status);

    if (response.status === 401) {
      const responseText = await response.text();
      this.logFailedRequest(url, {}, response.status, responseText, reconnectMessage);

      if (!retryOnUnauthorized) {
        throw new ContaAzulApiError(reconnectMessage, response.status);
      }

      try {
        this.accessToken = await refreshContaAzulAccessToken();
      } catch (error) {
        console.error(
          "Conta Azul token refresh failed after unauthorized response:",
          error instanceof Error ? error.message : error,
        );
        throw new ContaAzulApiError(reconnectMessage, response.status);
      }

      return this.post<TPayload, TResponse>(path, payload, false);
    }

    if (!response.ok) {
      const responseText = await response.text();
      const message = getErrorMessage(response.status, responseText);

      this.logFailedRequest(url, {}, response.status, responseText, message);

      throw new ContaAzulApiError(message, response.status);
    }

    return (await response.json()) as TResponse;
  }

  private async getJsonWithDebug(
    path: string,
    query: ContaAzulQueryParams,
    logLabel: "listFinancialAccounts" | "listRevenueCategories",
    retryOnUnauthorized = true,
  ): Promise<unknown> {
    const url = new URL(path, this.baseUrl);

    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== "") {
            url.searchParams.append(key, item);
          }
        }
      } else if (value !== undefined && value !== "") {
        url.searchParams.append(key, String(value));
      }
    }

    this.logRequest(url, query);
    console.log(`[conta-azul] ${logLabel} endpoint`, {
      url: `${url.origin}${url.pathname}`,
      queryParams: buildLogQueryParams(query),
    });

    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const responseText = await response.text();
    const body = parseResponseBody(responseText);

    this.logResponse(url, query, response.status);
    console.log(`[conta-azul] ${logLabel} status`, response.status);
    console.log(`[conta-azul] ${logLabel} body`, sanitizeLogBody(body));

    if (response.status === 401) {
      this.logFailedRequest(url, query, response.status, responseText, reconnectMessage);

      if (!retryOnUnauthorized) {
        throw new ContaAzulApiError(reconnectMessage, response.status);
      }

      try {
        this.accessToken = await refreshContaAzulAccessToken();
      } catch (error) {
        console.error(
          "Conta Azul token refresh failed after unauthorized response:",
          error instanceof Error ? error.message : error,
        );
        throw new ContaAzulApiError(reconnectMessage, response.status);
      }

      return this.getJsonWithDebug(path, query, logLabel, false);
    }

    if (!response.ok) {
      const message = getErrorMessage(response.status, responseText);

      this.logFailedRequest(url, query, response.status, responseText, message);

      throw new ContaAzulApiError(message, response.status);
    }

    return body;
  }

  private async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    let tokens = null;

    try {
      tokens = await getContaAzulTokens();
    } catch (error) {
      console.error(
        "Conta Azul token-store access error:",
        error instanceof Error ? error.message : error,
      );
    }

    if (tokens?.accessToken && tokens.status === "connected") {
      this.accessToken = tokens.accessToken;
      return tokens.accessToken;
    }

    if (process.env.NODE_ENV === "development" && process.env.CONTA_AZUL_ACCESS_TOKEN) {
      this.accessToken = process.env.CONTA_AZUL_ACCESS_TOKEN;
      return this.accessToken;
    }

    throw new ContaAzulApiError(accessTokenNotConfiguredMessage);
  }

  private logFailedRequest(
    url: URL,
    query: ContaAzulQueryParams,
    status: number,
    responseText: string,
    message: string,
  ) {
    const queryParams = buildLogQueryParams(query);

    console.error("Conta Azul API request failed:", {
      url: `${url.origin}${url.pathname}`,
      queryParams,
      status,
      responseText,
      message,
      ...(status === 400
        ? {
            rejectedFilters: queryParams,
          }
        : {}),
    });
  }

  private logRequest(url: URL, query: ContaAzulQueryParams) {
    console.info("Conta Azul API request:", {
      url: `${url.origin}${url.pathname}`,
      queryParams: buildLogQueryParams(query),
    });
  }

  private logResponse(url: URL, query: ContaAzulQueryParams, status: number) {
    console.info("Conta Azul API response:", {
      url: `${url.origin}${url.pathname}`,
      queryParams: buildLogQueryParams(query),
      status,
    });
  }
}

function getContaAzulConfig(): ContaAzulClientConfig {
  return {
    baseUrl: process.env.CONTA_AZUL_BASE_URL || DEFAULT_CONTA_AZUL_BASE_URL,
    accessToken: process.env.CONTA_AZUL_ACCESS_TOKEN,
  };
}

function getErrorMessage(status: number, responseText: string) {
  if (status === 401) {
    return reconnectMessage;
  }

  if (status === 403) {
    return "Conta Azul conectada, mas sem permissão para acessar contas a receber.";
  }

  const fallback = `Erro na API Conta Azul (${status}).`;

  try {
    const body = JSON.parse(responseText) as { message?: string; erro?: string };
    return body.message ?? body.erro ?? fallback;
  } catch {
    return fallback;
  }
}

function getDefaultFromDueDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 12);
  return date.toISOString().slice(0, 10);
}

function getDefaultToDueDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 12);
  return date.toISOString().slice(0, 10);
}

function buildReceivablesQueryParams(params: SearchReceivablesParams = {}) {
  const statusParamName = params.statusParamName ?? "status";

  return {
    [statusParamName]: params.status ?? "ATRASADO",
    data_vencimento_de: params.fromDueDate ?? getDefaultFromDueDate(),
    data_vencimento_ate: params.toDueDate ?? getDefaultToDueDate(),
  };
}

function buildPeopleQueryParams(params: SearchPeopleParams = {}) {
  return {
    ids: params.ids?.join(","),
    documentos: params.document,
    busca: params.search,
    tipo_perfil: "Cliente",
    tipo_pessoa: params.onlyIndividuals ? "FISICA" : undefined,
  };
}

function buildCreateReceivablePayload(
  input: ContaAzulCreateReceivableInput,
): ContaAzulCreateReceivablePayload {
  return {
    id_cliente: input.customerId,
    valor: input.amount,
    descricao: input.description,
    data_competencia: input.competenceDate,
    conta_financeira: input.financialAccountId,
    rateio: [
      {
        id_categoria: input.revenueCategoryId,
        valor: input.amount,
      },
    ],
    condicao_pagamento: {
      parcelas: [
        {
          descricao: "Parcela Única",
          data_vencimento: input.dueDate,
          conta_financeira: input.financialAccountId,
          detalhe_valor: {
            valor_bruto: input.amount,
          },
        },
      ],
    },
  };
}

function normalizeFinancialAccounts(body: unknown): ContaAzulFinancialAccount[] {
  return getBodyItems(body, ["itens", "items", "data"])
    .map((item) => {
      if (!isRecord(item) || !item.id || !item.nome) {
        return null;
      }

      return {
        id: String(item.id),
        nome: String(item.nome),
        ativo: item.ativo === true,
        tipo: typeof item.tipo === "string" ? item.tipo : "",
      };
    })
    .filter((item): item is ContaAzulFinancialAccount => Boolean(item));
}

function normalizeRevenueCategories(body: unknown): ContaAzulRevenueCategory[] {
  return getBodyItems(body, ["items", "itens", "data"])
    .map((item) => {
      if (!isRecord(item) || !item.id || !item.nome) {
        return null;
      }

      return {
        id: String(item.id),
        nome: String(item.nome),
        tipo: typeof item.tipo === "string" ? item.tipo : "RECEITA",
      };
    })
    .filter((item): item is ContaAzulRevenueCategory => Boolean(item));
}

function getBodyItems(body: unknown, keys: string[]) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isRecord(body)) {
    return [];
  }

  for (const key of keys) {
    const value = body[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function parseResponseBody(responseText: string) {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function sanitizeLogBody(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogBody(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      shouldRedactKey(key) ? "[redacted]" : sanitizeLogBody(item),
    ]),
  );
}

function buildLogQueryParams(query: ContaAzulQueryParams) {
  return Object.fromEntries(
    Object.entries(query).filter(
      ([, value]) =>
        value !== undefined &&
        value !== "" &&
        (!Array.isArray(value) || value.length > 0),
    ).map(([key, value]) => [key, sanitizeLogQueryValue(key, value)]),
  );
}

function sanitizeLogQueryValue(key: string, value: ContaAzulQueryValue) {
  if (shouldRedactKey(key)) {
    return "[redacted]";
  }

  return value;
}

function shouldRedactKey(key: string) {
  const normalizedKey = key.toLowerCase();

  return (
    normalizedKey.includes("token") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("document") ||
    normalizedKey.includes("cpf") ||
    normalizedKey.includes("cnpj")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
