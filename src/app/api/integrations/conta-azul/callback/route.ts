import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeContaAzulAuthorizationCode } from "@/features/finance/conta-azul/auth";

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
      new URL("/financeiro/inadimplencia?connectionError=conta_azul", request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/financeiro/inadimplencia?connectionError=missing_code", request.url),
    );
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/financeiro/inadimplencia?connectionError=invalid_state", request.url),
    );
  }

  try {
    await exchangeContaAzulAuthorizationCode(code);

    return NextResponse.redirect(
      new URL("/financeiro/inadimplencia?connected=conta_azul", request.url),
    );
  } catch (exchangeError) {
    console.error(
      "Conta Azul OAuth callback exchange error:",
      exchangeError instanceof Error ? exchangeError.message : exchangeError,
    );

    return NextResponse.redirect(
      new URL("/financeiro/inadimplencia?connectionError=token_exchange", request.url),
    );
  }
}
