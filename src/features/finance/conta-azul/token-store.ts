import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const CONTA_AZUL_PROVIDER = "conta_azul";
const DEFAULT_CONTA_AZUL_TOKEN_URL = "https://auth.contaazul.com/oauth2/token";
const reconnectMessage = "Conta Azul precisa ser reconectada.";
const tokenSafetyMarginMs = 2 * 60 * 1000;

export type ContaAzulTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  status: "connected" | "expired" | "disconnected";
};

type SaveContaAzulTokensInput = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  status?: ContaAzulTokens["status"];
};

type ContaAzulTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type IntegrationConnectionRow = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  status: string | null;
};

export async function getContaAzulTokens(): Promise<ContaAzulTokens | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .select("access_token, refresh_token, expires_at, status")
    .eq("provider", CONTA_AZUL_PROVIDER)
    .eq("status", "connected")
    .maybeSingle();

  if (error) {
    logSupabaseTokenError("Conta Azul token load error:", error);
    return null;
  }

  if (!data?.access_token) {
    return null;
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string | null) ?? null,
    expiresAt: (data.expires_at as string | null) ?? null,
    status: data.status as ContaAzulTokens["status"],
  };
}

export async function getValidContaAzulAccessToken() {
  const connection = await getContaAzulConnection();

  if (!connection) {
    throw new Error("Conta Azul não conectada.");
  }

  if (!connection.refresh_token) {
    await markContaAzulConnectionExpired();
    throw new Error(reconnectMessage);
  }

  if (
    connection.access_token &&
    connection.status === "connected" &&
    isTokenFresh(connection.expires_at)
  ) {
    return connection.access_token;
  }

  return refreshContaAzulAccessTokenWithRefreshToken(connection.refresh_token);
}

export async function refreshContaAzulAccessTokenWithRefreshToken(
  refreshToken?: string | null,
) {
  const effectiveRefreshToken =
    refreshToken ?? (await getContaAzulConnection())?.refresh_token ?? null;

  if (!effectiveRefreshToken) {
    await markContaAzulConnectionExpired();
    throw new Error(reconnectMessage);
  }

  try {
    console.info("Conta Azul token refresh start:", {
      provider: CONTA_AZUL_PROVIDER,
    });

    const tokenResponse = await requestContaAzulRefreshToken(effectiveRefreshToken);
    const accessToken = requireAccessToken(tokenResponse);

    await saveContaAzulTokens({
      accessToken,
      refreshToken: tokenResponse.refresh_token ?? effectiveRefreshToken,
      expiresIn: tokenResponse.expires_in ?? null,
      status: "connected",
    });

    console.info("Conta Azul token refresh success:", {
      provider: CONTA_AZUL_PROVIDER,
      hasNewRefreshToken: Boolean(tokenResponse.refresh_token),
      expiresIn: tokenResponse.expires_in,
    });

    return accessToken;
  } catch (error) {
    await markContaAzulConnectionExpired();
    console.error("Conta Azul token refresh failed:", {
      provider: CONTA_AZUL_PROVIDER,
      message: error instanceof Error ? error.message : error,
    });
    throw new Error(reconnectMessage);
  }
}

export async function saveContaAzulTokens(tokens: SaveContaAzulTokensInput) {
  const supabase = createAdminClient();
  const expiresAt =
    typeof tokens.expiresIn === "number"
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null;
  const payload = {
    provider: CONTA_AZUL_PROVIDER,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? null,
    expires_at: expiresAt,
    status: tokens.status ?? "connected",
    updated_at: new Date().toISOString(),
  };

  console.info("Conta Azul token storage start:", {
    provider: CONTA_AZUL_PROVIDER,
    hasAccessToken: Boolean(tokens.accessToken),
    hasRefreshToken: Boolean(tokens.refreshToken),
    expiresIn: tokens.expiresIn,
    expiresAt,
  });

  const { error } = await supabase.from("integration_connections").upsert(
    payload,
    {
      onConflict: "provider",
    },
  );

  if (error) {
    logSupabaseTokenError("Conta Azul token save error:", error);
    throw new Error("Não foi possível salvar a conexão Conta Azul.");
  }

  console.info("Conta Azul token storage success:", {
    provider: CONTA_AZUL_PROVIDER,
    status: payload.status,
    expiresAt,
  });
}

export async function clearContaAzulTokens(
  status: "expired" | "disconnected" = "disconnected",
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("integration_connections").upsert(
    {
      provider: CONTA_AZUL_PROVIDER,
      access_token: null,
      refresh_token: null,
      expires_at: null,
      status,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "provider",
    },
  );

  if (error) {
    logSupabaseTokenError("Conta Azul token clear error:", error);
  }
}

async function getContaAzulConnection(): Promise<IntegrationConnectionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .select("access_token, refresh_token, expires_at, status")
    .eq("provider", CONTA_AZUL_PROVIDER)
    .maybeSingle();

  if (error) {
    logSupabaseTokenError("Conta Azul connection load error:", error);
    throw new Error("Conta Azul não conectada.");
  }

  return (data as IntegrationConnectionRow | null) ?? null;
}

async function markContaAzulConnectionExpired() {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("integration_connections")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("provider", CONTA_AZUL_PROVIDER);

  if (error) {
    logSupabaseTokenError("Conta Azul token expire status error:", error);
  }
}

function isTokenFresh(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() - tokenSafetyMarginMs > Date.now();
}

async function requestContaAzulRefreshToken(refreshToken: string) {
  const tokenUrl = process.env.CONTA_AZUL_TOKEN_URL || DEFAULT_CONTA_AZUL_TOKEN_URL;
  const clientId = process.env.CONTA_AZUL_CLIENT_ID;
  const clientSecret = process.env.CONTA_AZUL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Configuração OAuth da Conta Azul incompleta.");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Conta Azul token refresh response failed:", {
      provider: CONTA_AZUL_PROVIDER,
      status: response.status,
      tokenUrl,
      responseText: sanitizeTokenResponseText(await safeReadResponseText(response)),
    });
    throw new Error(`Erro OAuth Conta Azul (${response.status}).`);
  }

  return (await response.json()) as ContaAzulTokenResponse;
}

function sanitizeTokenResponseText(responseText: string | undefined) {
  if (!responseText) {
    return responseText;
  }

  return responseText
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token":"[redacted]"')
    .replace(/"client_secret"\s*:\s*"[^"]+"/gi, '"client_secret":"[redacted]"');
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

function logSupabaseTokenError(
  label: string,
  error: {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  },
) {
  console.error(label, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
}
