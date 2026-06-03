"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { roomFormSchema } from "@/features/rooms/schemas";

export type RoomActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

const idSchema = z.string().uuid();

function roomFormDataToObject(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    capacity: String(formData.get("capacity") ?? ""),
    color: String(formData.get("color") ?? ""),
    sort_order: String(formData.get("sort_order") ?? "0"),
    active: formData.get("active") === "on",
  };
}

export async function createRoom(
  _previousState: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const parsed = roomFormSchema.safeParse(roomFormDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("rooms").insert(parsed.data);

  if (error) {
    console.error("[ROOMS] create error", error);
    return {
      message:
        error.code === "PGRST205"
          ? "A tabela public.rooms não existe. Rode o SQL das salas no Supabase remoto."
          : "Não foi possível cadastrar a sala. Verifique se o slug já existe.",
    };
  }

  revalidatePath("/salas");
  revalidatePath("/rodizio-salas");

  return {
    message: "Sala cadastrada com sucesso.",
  };
}

export async function updateRoom(
  roomId: string,
  _previousState: RoomActionState,
  formData: FormData,
): Promise<RoomActionState> {
  const id = idSchema.safeParse(roomId);
  const parsed = roomFormSchema.safeParse(roomFormDataToObject(formData));

  if (!id.success || !parsed.success) {
    return {
      errors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rooms")
    .update(parsed.data)
    .eq("id", id.data);

  if (error) {
    console.error("[ROOMS] update error", error);
    return {
      message: "Não foi possível atualizar a sala. Verifique se o slug já existe.",
    };
  }

  revalidatePath("/salas");
  revalidatePath("/rodizio-salas");

  return {
    message: "Sala atualizada com sucesso.",
  };
}

export async function toggleRoomActive(formData: FormData) {
  const id = idSchema.safeParse(String(formData.get("roomId") ?? ""));
  const active = String(formData.get("active") ?? "") === "true";

  if (!id.success) {
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rooms")
    .update({ active })
    .eq("id", id.data);

  if (error) {
    console.error("[ROOMS] toggle active error", error);
  }

  revalidatePath("/salas");
  revalidatePath("/rodizio-salas");
}

export async function deleteRoom(formData: FormData) {
  const id = idSchema.safeParse(String(formData.get("roomId") ?? ""));

  if (!id.success) {
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("rooms").delete().eq("id", id.data);

  if (error) {
    console.error("[ROOMS] delete error", error);
  }

  revalidatePath("/salas");
  revalidatePath("/rodizio-salas");
}
