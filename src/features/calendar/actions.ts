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

export type CalendarActionState = {
  errors?: Record<string, string[]>;
  message?: string;
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
  const { error } = await supabase.from("calendar_events").insert({
    ...parsed.data,
    created_by: permission.userId,
  });

  if (error) {
    console.error("Calendar event insert error:", error);
    return { message: "Não foi possível cadastrar o evento." };
  }

  revalidatePath("/calendario");
  revalidatePath("/chamada");

  return { message: "Evento cadastrado com sucesso." };
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
  const { error } = await supabase
    .from("calendar_events")
    .update(parsed.data)
    .eq("id", eventId);

  if (error) {
    console.error("Calendar event update error:", error);
    return { message: "Não foi possível atualizar o evento." };
  }

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
