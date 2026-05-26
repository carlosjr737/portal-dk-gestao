import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/features/auth/session";
import { exchangeGoogleAuthorizationCode } from "@/features/calendar/google-calendar";

const stateCookieName = "google_calendar_oauth_state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(stateCookieName)?.value;

  cookieStore.delete(stateCookieName);

  if (error) {
    console.error("Google Calendar OAuth callback returned error:", error);
    return NextResponse.redirect(
      new URL("/calendario?googleError=oauth", request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/calendario?googleError=missing_code", request.url),
    );
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/calendario?googleError=invalid_state", request.url),
    );
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await exchangeGoogleAuthorizationCode(code, user.id);

    return NextResponse.redirect(
      new URL("/calendario?googleConnected=1", request.url),
    );
  } catch (callbackError) {
    console.error(
      "Google Calendar OAuth callback error:",
      callbackError instanceof Error ? callbackError.message : callbackError,
    );

    return NextResponse.redirect(
      new URL("/calendario?googleError=callback", request.url),
    );
  }
}
