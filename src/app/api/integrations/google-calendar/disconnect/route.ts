import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/features/auth/session";
import {
  disconnectGoogleCalendar,
  getActiveGoogleCalendarConnection,
} from "@/features/calendar/google-calendar";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const connection = await getActiveGoogleCalendarConnection(user.id);

    if (connection) {
      await disconnectGoogleCalendar(connection.id);
    }

    return NextResponse.redirect(
      new URL("/calendario?googleDisconnected=1", request.url),
    );
  } catch (error) {
    console.error(
      "Google Calendar disconnect error:",
      error instanceof Error ? error.message : error,
    );

    return NextResponse.redirect(
      new URL("/calendario?googleError=disconnect", request.url),
    );
  }
}
