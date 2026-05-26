"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";
import { calendarEventFormSchema } from "@/features/calendar/schemas";
import type {
  CalendarEvent,
  CalendarEventFormOptions,
  CalendarEventType,
  CalendarSelectOption,
} from "@/features/calendar/types";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getActiveGoogleCalendarConnection,
  importGoogleCalendarEvents,
  listGoogleCalendars,
  updateGoogleCalendarEvent,
  updateGoogleCalendarSelection,
  type GoogleCalendarConnection,
  type GoogleCalendarOption,
} from "@/features/calendar/google-calendar";

export type CalendarActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

export type GoogleCalendarStatus = {
  connected: boolean;
  googleEmail: string | null;
  calendarId: string | null;
  lastSyncedAt: string | null;
  calendars: GoogleCalendarOption[];
};

function formDataToObject(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    event_type: String(formData.get("event_type") ?? "evento"),
    start_date: String(formData.get("start_date") ?? ""),
    end_date: String(formData.get("end_date") ?? ""),
    all_day: formData.get("all_day") === "on",
    start_time: String(formData.get("start_time") ?? ""),
    end_time: String(formData.get("end_time") ?? ""),
    affects_classes: formData.get("affects_classes") === "on",
    affects_all_classes: formData.get("affects_all_classes") === "on",
    class_id: String(formData.get("class_id") ?? ""),
    teacher_id: String(formData.get("teacher_id") ?? ""),
    modality_id: String(formData.get("modality_id") ?? ""),
    level_id: String(formData.get("level_id") ?? ""),
  };
}

async function assertCanManageCalendar() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { allowed: false as const, userId: null };
  }

  const profile = await getProfileByUserId(user.id);
  const allowed = profile?.active && ["admin", "equipe"].includes(profile.role);

  return {
    allowed: allowed === true,
    userId: user.id,
  };
}

async function getCalendarPermission() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { canView: false, canManage: false, canDelete: false, userId: null };
  }

  const profile = await getProfileByUserId(user.id);

  if (!profile?.active) {
    return { canView: false, canManage: false, canDelete: false, userId: user.id };
  }

  return {
    canView: true,
    canManage: profile.role === "admin" || profile.role === "equipe",
    canDelete: profile.role === "admin",
    userId: user.id,
  };
}

export type CalendarFilters = {
  month: string;
  eventType: CalendarEventType | null;
  affectsClasses: "all" | "yes" | "no";
};

export async function listCalendarEvents(filters: CalendarFilters) {
  const permission = await getCalendarPermission();

  if (!permission.canView) {
    return [];
  }

  const supabase = createAdminClient();
  const { startDate, endDate } = getMonthRange(filters.month);
  let query = supabase
    .from("calendar_events")
    .select(
      "id, title, description, event_type, start_date, end_date, start_time, end_time, all_day, affects_classes, affects_all_classes, class_id, teacher_id, modality_id, level_id, google_calendar_event_id, google_calendar_id, sync_source, created_by, created_at, updated_at",
    )
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (filters.eventType) {
    query = query.eq("event_type", filters.eventType);
  }

  if (filters.affectsClasses === "yes") {
    query = query.eq("affects_classes", true);
  }

  if (filters.affectsClasses === "no") {
    query = query.eq("affects_classes", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Calendar events load error:", error);
    return [];
  }

  return (data ?? []) as CalendarEvent[];
}

export async function getCalendarFormOptions(): Promise<CalendarEventFormOptions> {
  const permission = await getCalendarPermission();

  if (!permission.canView) {
    return { classes: [], teachers: [], modalities: [], levels: [] };
  }

  const supabase = createAdminClient();
  const [
    { data: classes, error: classesError },
    { data: teachers, error: teachersError },
    { data: modalities, error: modalitiesError },
    { data: levels, error: levelsError },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name")
      .neq("status", "inactive")
      .order("name", { ascending: true }),
    supabase
      .from("staff_members")
      .select("id, full_name, artistic_name")
      .eq("role", "professor")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    supabase
      .from("modalities")
      .select("id, name")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("levels")
      .select("id, name")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const firstError = classesError ?? teachersError ?? modalitiesError ?? levelsError;

  if (firstError) {
    console.error("Calendar form options load error:", firstError);
  }

  return {
    classes: ((classes ?? []) as CalendarSelectOption[]).map((item) => ({
      id: item.id,
      name: item.name,
    })),
    teachers: ((teachers ?? []) as Array<{
      id: string;
      full_name: string | null;
      artistic_name: string | null;
    }>).map((teacher) => ({
      id: teacher.id,
      name: teacher.artistic_name || teacher.full_name || "Professor sem nome",
    })),
    modalities: ((modalities ?? []) as CalendarSelectOption[]).map((item) => ({
      id: item.id,
      name: item.name,
    })),
    levels: ((levels ?? []) as CalendarSelectOption[]).map((item) => ({
      id: item.id,
      name: item.name,
    })),
  };
}

export async function getGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  const permission = await getCalendarPermission();

  if (!permission.canView) {
    return {
      connected: false,
      googleEmail: null,
      calendarId: null,
      lastSyncedAt: null,
      calendars: [],
    };
  }

  const connection = await getActiveGoogleCalendarConnection(permission.userId);

  if (!connection) {
    return {
      connected: false,
      googleEmail: null,
      calendarId: null,
      lastSyncedAt: null,
      calendars: [],
    };
  }

  try {
    return {
      connected: true,
      googleEmail: connection.google_email,
      calendarId: connection.calendar_id ?? "primary",
      lastSyncedAt: connection.last_synced_at,
      calendars: await listGoogleCalendars(connection),
    };
  } catch (error) {
    console.error(
      "Google Calendar status load error:",
      error instanceof Error ? error.message : error,
    );

    return {
      connected: true,
      googleEmail: connection.google_email,
      calendarId: connection.calendar_id ?? "primary",
      lastSyncedAt: connection.last_synced_at,
      calendars: [],
    };
  }
}

export async function createCalendarEvent(
  _previousState: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const permission = await assertCanManageCalendar();

  if (!permission.allowed) {
    return { message: "Acesso não autorizado." };
  }

  const parsed = calendarEventFormSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      ...parsed.data,
      created_by: permission.userId,
      sync_source: "portal",
    })
    .select(
      "id, title, description, event_type, start_date, end_date, start_time, end_time, all_day, affects_classes, affects_all_classes, class_id, teacher_id, modality_id, level_id, google_calendar_event_id, google_calendar_id, sync_source, created_by, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    console.error("Calendar event insert error:", error);
    return { message: "Não foi possível cadastrar o evento." };
  }

  await syncCreatedEventToGoogle(data as CalendarEvent, permission.userId);

  revalidatePath("/calendario");
  revalidatePath("/chamada");

  return { message: "Evento cadastrado com sucesso." };
}

async function syncCreatedEventToGoogle(event: CalendarEvent, userId: string | null) {
  try {
    const connection = await getActiveGoogleCalendarConnection(userId);

    if (!connection) {
      return;
    }

    const googleEventId = await createGoogleCalendarEvent(event, connection);
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("calendar_events")
      .update({
        google_calendar_event_id: googleEventId,
        google_calendar_id: connection.calendar_id ?? "primary",
      })
      .eq("id", event.id);

    if (error) {
      console.error("Calendar event Google id update error:", error.message);
    }
  } catch (error) {
    console.error(
      "Google Calendar event create sync error:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function syncUpdatedEventToGoogle(event: CalendarEvent, userId: string | null) {
  try {
    const connection = await getActiveGoogleCalendarConnection(userId);

    if (!connection || !event.google_calendar_event_id) {
      return;
    }

    await updateGoogleCalendarEvent(event, connection);
  } catch (error) {
    console.error(
      "Google Calendar event update sync error:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function syncDeletedEventToGoogle(
  event: CalendarEvent,
  connection: GoogleCalendarConnection | null,
) {
  try {
    if (!connection || !event.google_calendar_event_id) {
      return;
    }

    await deleteGoogleCalendarEvent(event, connection);
  } catch (error) {
    console.error(
      "Google Calendar event delete sync error:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function selectCalendarEvent(eventId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      "id, title, description, event_type, start_date, end_date, start_time, end_time, all_day, affects_classes, affects_all_classes, class_id, teacher_id, modality_id, level_id, google_calendar_event_id, google_calendar_id, sync_source, created_by, created_at, updated_at",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    console.error("Calendar event load error:", error.message);
    return null;
  }

  return (data ?? null) as CalendarEvent | null;
}

export async function changeGoogleCalendar(formData: FormData) {
  const permission = await assertCanManageCalendar();

  if (!permission.allowed) {
    return;
  }

  const calendarId = String(formData.get("calendar_id") ?? "primary");

  try {
    await updateGoogleCalendarSelection(permission.userId, calendarId);
    revalidatePath("/calendario");
  } catch (error) {
    console.error(
      "Google Calendar selection action error:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function syncGoogleCalendarMonth(formData: FormData) {
  const permission = await assertCanManageCalendar();

  if (!permission.allowed) {
    return;
  }

  const month = String(formData.get("month") ?? getCurrentMonthValue());

  try {
    const connection = await getActiveGoogleCalendarConnection(permission.userId);

    if (!connection) {
      return;
    }

    await importGoogleCalendarEvents({ month, connection });
    revalidatePath("/calendario");
  } catch (error) {
    console.error(
      "Google Calendar import action error:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function updateCalendarEvent(
  eventId: string,
  _previousState: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const permission = await assertCanManageCalendar();

  if (!permission.allowed) {
    return { message: "Acesso não autorizado." };
  }

  const parsed = calendarEventFormSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .update(parsed.data)
    .eq("id", eventId)
    .select(
      "id, title, description, event_type, start_date, end_date, start_time, end_time, all_day, affects_classes, affects_all_classes, class_id, teacher_id, modality_id, level_id, google_calendar_event_id, google_calendar_id, sync_source, created_by, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    console.error("Calendar event update error:", error);
    return { message: "Não foi possível atualizar o evento." };
  }

  await syncUpdatedEventToGoogle(data as CalendarEvent, permission.userId);

  revalidatePath("/calendario");
  revalidatePath("/chamada");

  return { message: "Evento atualizado com sucesso." };
}

export async function deleteCalendarEvent(formData: FormData) {
  const permission = await getCalendarPermission();

  if (!permission.canDelete) {
    return;
  }

  const eventId = String(formData.get("event_id") ?? "");

  if (!eventId) {
    return;
  }

  const event = await selectCalendarEvent(eventId);
  const connection = await getActiveGoogleCalendarConnection(permission.userId);

  if (event) {
    await syncDeletedEventToGoogle(event, connection);
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    console.error("Calendar event delete error:", error);
    return;
  }

  revalidatePath("/calendario");
  revalidatePath("/chamada");
}

function getMonthRange(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  return {
    startDate: formatDateValue(start),
    endDate: formatDateValue(end),
  };
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getCurrentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}
