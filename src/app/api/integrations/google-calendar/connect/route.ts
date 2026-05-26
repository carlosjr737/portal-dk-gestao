import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { buildGoogleCalendarAuthorizationUrl } from "@/features/calendar/google-calendar";
import { getAuthenticatedUser } from "@/features/auth/session";

const stateCookieName = "google_calendar_oauth_state";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    const authorizationUrl = buildGoogleCalendarAuthorizationUrl(state);

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
      "Google Calendar OAuth connect error:",
      error instanceof Error ? error.message : error,
    );

    return NextResponse.redirect(
      new URL("/calendario?googleError=connect", request.url),
    );
  }
}
