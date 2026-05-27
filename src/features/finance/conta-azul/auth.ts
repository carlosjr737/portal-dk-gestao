import "server-only";

import {
  clearContaAzulTokens,
  getContaAzulTokens,
  refreshContaAzulAccessTokenWithRefreshToken,
  saveContaAzulTokens,
} from "@/features/finance/conta-azul/token-store";

const DEFAULT_CONTA_AZUL_AUTH_URL = "https://auth.contaazul.com/login";
const DEFAULT_CONTA_AZUL_TOKEN_URL = "https://auth.contaazul.com/oauth2/token";
const CONTA_AZUL_SCOPE = "openid profile aws.cognito.signin.user.admin";
const reconnectMessage = "Conta Azul precisa ser reconectada.";

type ContaAzulTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

export class ContaAzulTokenExchangeError extends Error {
  constructor(
    message: string,
    public readonly details: {
      status?: number;
      responseText?: string;
      redirectUri: string;
      tokenUrl: string;
    },
  ) {
    super(message);
    this.name = "ContaAzulTokenExchangeError";
  }
}

export class ContaAzulTokenStorageError extends Error {
  constructor(message = "Não foi possível salvar a conexão Conta Azul.") {
    super(message);
    this.name = "ContaAzulTokenStorageError";
  }
}

export function getContaAzulOAuthDiagnostics() {
  return {
    redirectUri: process.env.CONTA_AZUL_REDIRECT_URI,
    tokenUrl: process.env.CONTA_AZUL_TOKEN_URL || DEFAULT_CONTA_AZUL_TOKEN_URL,
    hasClientId: Boolean(process.env.CONTA_AZUL_CLIENT_ID),
    hasClientSecret: Boolean(process.env.CONTA_AZUL_CLIENT_SECRET),
  };
}

export function buildContaAzulAuthorizationUrl(state: string) {
  const config = getContaAzulOAuthConfig();
  const url = new URL(config.authUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", CONTA_AZUL_SCOPE);

  return url;
}

export async function exchangeContaAzulAuthorizationCode(code: string) {
  const config = getContaAzulOAuthConfig();
  const tokenResponse = await requestContaAzulToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  console.info("Conta Azul OAuth token response received:", {
    hasAccessToken: Boolean(tokenResponse.access_token),
    hasRefreshToken: Boolean(tokenResponse.refresh_token),
    expiresIn: tokenResponse.expires_in,
  });

  try {
    await saveContaAzulTokens({
      accessToken: requireAccessToken(tokenResponse),
      refreshToken: tokenResponse.refresh_token ?? null,
      expiresIn: tokenResponse.expires_in ?? null,
      status: "connected",
    });
  } catch (error) {
    console.error(
      "Conta Azul OAuth token storage error:",
      error instanceof Error ? error.message : error,
    );
    throw new ContaAzulTokenStorageError();
  }
}

export async function refreshContaAzulAccessToken() {
  const tokens = await getContaAzulTokens();

  if (!tokens?.refreshToken) {
    await clearContaAzulTokens("expired");
    throw new Error(reconnectMessage);
  }

  return refreshContaAzulAccessTokenWithRefreshToken(tokens.refreshToken);
}

function getContaAzulOAuthConfig() {
  const authUrl = process.env.CONTA_AZUL_AUTH_URL || DEFAULT_CONTA_AZUL_AUTH_URL;
  const tokenUrl =
    process.env.CONTA_AZUL_TOKEN_URL || DEFAULT_CONTA_AZUL_TOKEN_URL;
  const clientId = process.env.CONTA_AZUL_CLIENT_ID;
  const clientSecret = process.env.CONTA_AZUL_CLIENT_SECRET;
  const redirectUri = process.env.CONTA_AZUL_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Configuração OAuth da Conta Azul incompleta.");
  }

  return {
    authUrl,
    tokenUrl,
    clientId,
    clientSecret,
    redirectUri,
  };
}

async function requestContaAzulToken(body: Record<string, string>) {
  const config = getContaAzulOAuthConfig();
  const basicAuth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ContaAzulTokenExchangeError(
      `Erro OAuth Conta Azul (${response.status}).`,
      {
        status: response.status,
        responseText: await safeReadResponseText(response),
        redirectUri: config.redirectUri,
        tokenUrl: config.tokenUrl,
      },
    );
  }

  return (await response.json()) as ContaAzulTokenResponse;
}

async function safeReadResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

function requireAccessToken(tokenResponse: ContaAzulTokenResponse) {
  if (!tokenResponse.access_token) {
    throw new Error("Conta Azul não retornou access_token.");
  }

  return tokenResponse.access_token;
}
