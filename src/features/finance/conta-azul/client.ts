import "server-only";

import type {
  ContaAzulPaginatedResponse,
  ContaAzulPerson,
  ContaAzulReceivable,
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
      const totalItems = response.itens_totais ?? response.totalItems;

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
    tipo_perfil: "Cliente",
    tipo_pessoa: params.onlyIndividuals ? "FISICA" : undefined,
  };
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
  const normalizedKey = key.toLowerCase();

  if (
    normalizedKey.includes("token") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("document")
  ) {
    return "[redacted]";
  }

  return value;
}
