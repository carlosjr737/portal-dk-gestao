import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildContaAzulAuthorizationUrl } from "@/features/finance/conta-azul/auth";

const stateCookieName = "conta_azul_oauth_state";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    const authorizationUrl = buildContaAzulAuthorizationUrl(state);

    cookieStore.set(stateCookieName, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: "/",
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error(
      "Conta Azul OAuth connect error:",
      error instanceof Error ? error.message : error,
    );

    return NextResponse.json(
      { message: "Não foi possível iniciar a conexão com a Conta Azul." },
      { status: 400 },
    );
  }
}
