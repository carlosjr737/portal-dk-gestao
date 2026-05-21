import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ContaAzulTokenExchangeError,
  ContaAzulTokenStorageError,
  exchangeContaAzulAuthorizationCode,
  getContaAzulOAuthDiagnostics,
} from "@/features/finance/conta-azul/auth";

const stateCookieName = "conta_azul_oauth_state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(stateCookieName)?.value;

  cookieStore.delete(stateCookieName);

  if (error) {
    console.error("Conta Azul OAuth callback returned error:", error);
    return NextResponse.redirect(
      new URL(
        "/financeiro/inadimplencia?connectionError=conta_azul",
        request.url,
      ),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/financeiro/inadimplencia?connectionError=missing_code",
        request.url,
      ),
    );
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL(
        "/financeiro/inadimplencia?connectionError=invalid_state",
        request.url,
      ),
    );
  }

  const diagnostics = getContaAzulOAuthDiagnostics();

  console.info("Conta Azul OAuth token exchange start:", {
    hasCode: Boolean(code),
    redirectUri: diagnostics.redirectUri,
    tokenUrl: diagnostics.tokenUrl,
    hasClientId: diagnostics.hasClientId,
    hasClientSecret: diagnostics.hasClientSecret,
  });

  try {
    await exchangeContaAzulAuthorizationCode(code);

    return NextResponse.redirect(
      new URL("/financeiro/inadimplencia?connected=conta_azul", request.url),
    );
  } catch (exchangeError) {
    const errorCode = getTokenExchangeErrorCode(exchangeError);

    if (exchangeError instanceof ContaAzulTokenExchangeError) {
      console.error("Conta Azul OAuth token exchange error:", {
        status: exchangeError.details.status,
        responseText: exchangeError.details.responseText,
        redirectUri: exchangeError.details.redirectUri,
        tokenUrl: exchangeError.details.tokenUrl,
      });
    } else {
      console.error(
        "Conta Azul OAuth callback exchange error:",
        exchangeError instanceof Error ? exchangeError.message : exchangeError,
      );
    }

    return NextResponse.redirect(
      new URL(
        `/financeiro/inadimplencia?connectionError=${errorCode}`,
        request.url,
      ),
    );
  }
}

function getTokenExchangeErrorCode(error: unknown) {
  if (error instanceof ContaAzulTokenStorageError) {
    return "token_storage";
  }

  if (!(error instanceof ContaAzulTokenExchangeError)) {
    return "token_exchange_unknown";
  }

  if (error.details.status === 400) {
    return "token_exchange_400";
  }

  if (error.details.status === 401) {
    return "token_exchange_401";
  }

  if (error.details.status === 403) {
    return "token_exchange_403";
  }

  if (error.details.status && error.details.status >= 500) {
    return "token_exchange_500";
  }

  return "token_exchange_unknown";
}
