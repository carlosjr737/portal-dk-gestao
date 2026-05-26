import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { CalendarEvent, CalendarEventType } from "@/features/calendar/types";

const googleAuthorizationUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleUserInfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
const googleCalendarApiUrl = "https://www.googleapis.com/calendar/v3";

export const googleCalendarScopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export type GoogleCalendarConnection = {
  id: string;
  user_id: string | null;
  google_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  calendar_id: string | null;
  status: string | null;
  last_synced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type GoogleCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
};

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type GoogleCalendarEventResponse = {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
};

export function buildGoogleCalendarAuthorizationUrl(state: string) {
  const credentials = getGoogleCredentials();
  const url = new URL(googleAuthorizationUrl);

  url.searchParams.set("client_id", credentials.clientId);
  url.searchParams.set("redirect_uri", credentials.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", googleCalendarScopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return url;
}

export async function exchangeGoogleAuthorizationCode(code: string, userId: string) {
  const credentials = getGoogleCredentials();
  const tokenResponse = await fetchGoogleToken({
    code,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    redirect_uri: credentials.redirectUri,
    grant_type: "authorization_code",
  });
  const googleEmail = await getGoogleUserEmail(tokenResponse.access_token);
  const expiresAt = getExpiresAt(tokenResponse.expires_in);
  const supabase = createAdminClient();
  const { data: existingConnection } = await supabase
    .from("google_calendar_connections")
    .select("id, refresh_token, calendar_id")
    .eq("user_id", userId)
    .maybeSingle();

  const payload = {
    user_id: userId,
    google_email: googleEmail,
    access_token: tokenResponse.access_token,
    refresh_token:
      tokenResponse.refresh_token ??
      ((existingConnection as GoogleCalendarConnection | null)?.refresh_token ?? null),
    expires_at: expiresAt,
    calendar_id:
      ((existingConnection as GoogleCalendarConnection | null)?.calendar_id ?? null) ??
      "primary",
    status: "connected",
  };

  const query = existingConnection
    ? supabase
        .from("google_calendar_connections")
        .update(payload)
        .eq("id", (existingConnection as GoogleCalendarConnection).id)
    : supabase.from("google_calendar_connections").insert(payload);

  const { error } = await query;

  if (error) {
    throw new Error("Google Calendar connection storage failed.");
  }
}

export async function getActiveGoogleCalendarConnection(userId?: string | null) {
  const supabase = createAdminClient();
  let query = supabase
    .from("google_calendar_connections")
    .select(
      "id, user_id, google_email, access_token, refresh_token, expires_at, calendar_id, status, last_synced_at, created_at, updated_at",
    )
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Google Calendar connection load error:", error.message);
    return null;
  }

  return (data ?? null) as GoogleCalendarConnection | null;
}

export async function disconnectGoogleCalendar(connectionId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({
      status: "disconnected",
      access_token: null,
    })
    .eq("id", connectionId);

  if (error) {
    throw new Error("Google Calendar disconnect failed.");
  }
}

export async function updateGoogleCalendarSelection(
  userId: string | null,
  calendarId: string,
) {
  const connection = await getActiveGoogleCalendarConnection(userId);

  if (!connection) {
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({ calendar_id: calendarId || "primary" })
    .eq("id", connection.id);

  if (error) {
    throw new Error("Google Calendar selection update failed.");
  }
}

export async function listGoogleCalendars(connection: GoogleCalendarConnection) {
  const accessToken = await getValidAccessToken(connection);
  const response = await googleFetch(
    `${googleCalendarApiUrl}/users/me/calendarList`,
    accessToken,
  );
  const data = (await response.json()) as {
    items?: Array<{ id: string; summary: string; primary?: boolean }>;
  };

  return (data.items ?? []).map((calendar) => ({
    id: calendar.id,
    summary: calendar.summary,
    primary: calendar.primary === true,
  }));
}

export async function createGoogleCalendarEvent(
  event: CalendarEvent,
  connection: GoogleCalendarConnection,
) {
  const accessToken = await getValidAccessToken(connection);
  const calendarId = encodeURIComponent(connection.calendar_id || "primary");
  const response = await googleFetch(
    `${googleCalendarApiUrl}/calendars/${calendarId}/events`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toGoogleEvent(event)),
    },
  );
  const data = (await response.json()) as GoogleCalendarEventResponse;

  return data.id;
}

export async function updateGoogleCalendarEvent(
  event: CalendarEvent,
  connection: GoogleCalendarConnection,
) {
  if (!event.google_calendar_event_id) {
    return;
  }

  const accessToken = await getValidAccessToken(connection);
  const calendarId = encodeURIComponent(event.google_calendar_id || connection.calendar_id || "primary");
  const eventId = encodeURIComponent(event.google_calendar_event_id);

  await googleFetch(
    `${googleCalendarApiUrl}/calendars/${calendarId}/events/${eventId}`,
    accessToken,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toGoogleEvent(event)),
    },
  );
}

export async function deleteGoogleCalendarEvent(
  event: CalendarEvent,
  connection: GoogleCalendarConnection,
) {
  if (!event.google_calendar_event_id) {
    return;
  }

  const accessToken = await getValidAccessToken(connection);
  const calendarId = encodeURIComponent(event.google_calendar_id || connection.calendar_id || "primary");
  const eventId = encodeURIComponent(event.google_calendar_event_id);
  const response = await fetch(
    `${googleCalendarApiUrl}/calendars/${calendarId}/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error("Google Calendar event delete failed.");
  }
}

export async function importGoogleCalendarEvents({
  month,
  connection,
}: {
  month: string;
  connection: GoogleCalendarConnection;
}) {
  const accessToken = await getValidAccessToken(connection);
  const calendarId = encodeURIComponent(connection.calendar_id || "primary");
  const { timeMin, timeMax } = getGoogleMonthRange(month);
  const url = new URL(`${googleCalendarApiUrl}/calendars/${calendarId}/events`);

  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const response = await googleFetch(url.toString(), accessToken);
  const data = (await response.json()) as {
    items?: GoogleCalendarEventResponse[];
  };
  const events = (data.items ?? [])
    .filter((event) => event.id && event.summary && (event.start?.date || event.start?.dateTime))
    .map((event) => fromGoogleEvent(event, connection.calendar_id || "primary"));

  if (events.length === 0) {
    await markConnectionSynced(connection.id);
    return 0;
  }

  const supabase = createAdminClient();

  for (const event of events) {
    const { data: existingEvent, error: existingError } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("google_calendar_event_id", event.google_calendar_event_id)
      .maybeSingle();

    if (existingError) {
      throw new Error("Google Calendar import lookup failed.");
    }

    const { error } = existingEvent
      ? await supabase
          .from("calendar_events")
          .update(event)
          .eq("id", existingEvent.id as string)
      : await supabase.from("calendar_events").insert(event);

    if (error) {
      throw new Error("Google Calendar import storage failed.");
    }
  }

  await markConnectionSynced(connection.id);
  return events.length;
}

async function getValidAccessToken(connection: GoogleCalendarConnection) {
  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
  const shouldRefresh =
    !connection.access_token ||
    !expiresAt ||
    expiresAt.getTime() - Date.now() < 60_000;

  if (!shouldRefresh) {
    return connection.access_token as string;
  }

  if (!connection.refresh_token) {
    throw new Error("Google Calendar refresh token missing.");
  }

  const credentials = getGoogleCredentials();
  const tokenResponse = await fetchGoogleToken({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: connection.refresh_token,
    grant_type: "refresh_token",
  });
  const accessToken = tokenResponse.access_token;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({
      access_token: accessToken,
      expires_at: getExpiresAt(tokenResponse.expires_in),
    })
    .eq("id", connection.id);

  if (error) {
    throw new Error("Google Calendar token refresh storage failed.");
  }

  return accessToken;
}

async function fetchGoogleToken(payload: Record<string, string>) {
  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload),
  });

  if (!response.ok) {
    throw new Error("Google OAuth token exchange failed.");
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function getGoogleUserEmail(accessToken: string) {
  const response = await googleFetch(googleUserInfoUrl, accessToken);
  const data = (await response.json()) as { email?: string };

  return data.email ?? null;
}

async function googleFetch(
  url: string,
  accessToken: string,
  init?: RequestInit,
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Google Calendar API request failed.");
  }

  return response;
}

async function markConnectionSynced(connectionId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", connectionId);

  if (error) {
    throw new Error("Google Calendar sync timestamp update failed.");
  }
}

function toGoogleEvent(event: CalendarEvent) {
  const descriptionParts = [event.description ?? ""];

  if (event.affects_classes) {
    descriptionParts.push("Afeta aulas no Portal DK.");
  }

  if (event.all_day) {
    return {
      summary: event.title,
      description: descriptionParts.filter(Boolean).join("\n\n"),
      start: { date: event.start_date },
      end: { date: addDays(event.end_date, 1) },
    };
  }

  return {
    summary: event.title,
    description: descriptionParts.filter(Boolean).join("\n\n"),
    start: {
      dateTime: `${event.start_date}T${event.start_time ?? "00:00:00"}`,
      timeZone: "America/Sao_Paulo",
    },
    end: {
      dateTime: `${event.end_date}T${event.end_time ?? event.start_time ?? "23:59:00"}`,
      timeZone: "America/Sao_Paulo",
    },
  };
}

function fromGoogleEvent(
  event: GoogleCalendarEventResponse,
  calendarId: string,
): Omit<CalendarEvent, "id" | "created_at" | "updated_at"> {
  const allDay = Boolean(event.start?.date);
  const startDate = allDay
    ? event.start?.date ?? ""
    : toDateValue(event.start?.dateTime ?? "");
  const endDate = allDay
    ? addDays(event.end?.date ?? startDate, -1)
    : toDateValue(event.end?.dateTime ?? event.start?.dateTime ?? "");

  return {
    title: event.summary ?? "Evento Google",
    description: event.description ?? null,
    event_type: "evento" as CalendarEventType,
    start_date: startDate,
    end_date: endDate || startDate,
    start_time: allDay ? null : toTimeValue(event.start?.dateTime ?? null),
    end_time: allDay ? null : toTimeValue(event.end?.dateTime ?? null),
    all_day: allDay,
    affects_classes: false,
    affects_all_classes: false,
    class_id: null,
    teacher_id: null,
    modality_id: null,
    level_id: null,
    google_calendar_event_id: event.id,
    google_calendar_id: calendarId,
    sync_source: "google",
    created_by: null,
  };
}

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google Calendar environment variables.");
  }

  return { clientId, clientSecret, redirectUri };
}

function getExpiresAt(expiresIn?: number) {
  const seconds = expiresIn ?? 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function getGoogleMonthRange(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return date.toISOString().slice(0, 10);
}

function toDateValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function toTimeValue(value: string | null) {
  return value ? value.slice(11, 19) : null;
}
