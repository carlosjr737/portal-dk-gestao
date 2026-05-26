"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";
import { calendarEventFormSchema } from "@/features/calendar/schemas";

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
  const permission = await assertCanManageCalendar();

  if (!permission.allowed) {
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
