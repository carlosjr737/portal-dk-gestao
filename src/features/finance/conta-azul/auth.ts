import "server-only";

import {
  clearContaAzulTokens,
  getContaAzulTokens,
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
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  await saveContaAzulTokens({
    accessToken: requireAccessToken(tokenResponse),
    refreshToken: tokenResponse.refresh_token ?? null,
    expiresIn: tokenResponse.expires_in ?? null,
    status: "connected",
  });
}

export async function refreshContaAzulAccessToken() {
  const tokens = await getContaAzulTokens();

  if (!tokens?.refreshToken) {
    await clearContaAzulTokens("expired");
    throw new Error(reconnectMessage);
  }

  try {
    const tokenResponse = await requestContaAzulToken({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    });
    const accessToken = requireAccessToken(tokenResponse);

    await saveContaAzulTokens({
      accessToken,
      refreshToken: tokenResponse.refresh_token ?? tokens.refreshToken,
      expiresIn: tokenResponse.expires_in ?? null,
      status: "connected",
    });

    return accessToken;
  } catch (error) {
    await clearContaAzulTokens("expired");
    console.error(
      "Conta Azul refresh token error:",
      error instanceof Error ? error.message : error,
    );
    throw new Error(reconnectMessage);
  }
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
    throw new Error(`Erro OAuth Conta Azul (${response.status}).`);
  }

  return (await response.json()) as ContaAzulTokenResponse;
}

function requireAccessToken(tokenResponse: ContaAzulTokenResponse) {
  if (!tokenResponse.access_token) {
    throw new Error("Conta Azul não retornou access_token.");
  }

  return tokenResponse.access_token;
}
