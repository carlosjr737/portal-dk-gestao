import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const CONTA_AZUL_PROVIDER = "conta_azul";

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
