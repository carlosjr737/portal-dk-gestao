"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRoomRotationQuery } from "@/features/room-rotation/data";
import { formatRotationMonth } from "@/features/room-rotation/constants";

const dayGroupSchema = z.enum(["SEG_QUA", "TER_QUI", "SEX", "SAB"]);
const rotationLabelSchema = z.enum([
  "Rodízio 1",
  "Rodízio 2",
  "Rodízio 3",
  "Rodízio 4",
  "Rodízio 5",
]);

const filterSchema = z.object({
  year: z.coerce.number().int().min(2000),
  month: z.coerce.number().int().min(1).max(12),
  dayGroup: dayGroupSchema,
  rotationLabel: rotationLabelSchema,
  status: z.enum(["", "draft", "published"]).optional(),
});

const assignmentSchema = filterSchema.extend({
  rotationPlanId: z.string().uuid(),
  classId: z.string().uuid(),
  roomId: z.string().uuid(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().or(z.literal("")),
});

function parseFilters(formData: FormData) {
  return filterSchema.parse({
    year: formData.get("year"),
    month: formData.get("month"),
    dayGroup: formData.get("dayGroup"),
    rotationLabel: formData.get("rotationLabel"),
    status: String(formData.get("status") ?? ""),
  });
}

export async function createRoomRotationPlan(formData: FormData) {
  const filters = parseFilters(formData);
  const supabase = createAdminClient();
  const name = `RODIZIO DE SALA ${filters.rotationLabel.replace("Rodízio ", "")} - ${formatRotationMonth(filters.year, filters.month).toUpperCase()}`;
  const { error } = await supabase.from("room_rotation_plans").upsert(
    {
      name,
      year: filters.year,
      month: filters.month,
      day_group: filters.dayGroup,
      rotation_label: filters.rotationLabel,
      status: "draft",
      notes: null,
    },
    {
      onConflict: "year,month,day_group,rotation_label",
    },
  );

  if (error) {
    console.error("[ROOM ROTATION] create plan error", error);
  }

  revalidatePath("/rodizio-salas");
  redirect(`/rodizio-salas?${buildRoomRotationQuery(filters)}`);
}

export async function saveRoomRotationAssignment(formData: FormData) {
  const parsed = assignmentSchema.parse({
    year: formData.get("year"),
    month: formData.get("month"),
    dayGroup: formData.get("dayGroup"),
    rotationLabel: formData.get("rotationLabel"),
    status: String(formData.get("status") ?? ""),
    rotationPlanId: formData.get("rotationPlanId"),
    classId: formData.get("classId"),
    roomId: formData.get("roomId"),
    startTime: formData.get("startTime"),
    endTime: String(formData.get("endTime") ?? ""),
  });
  const supabase = createAdminClient();
  const { error } = await supabase.from("room_rotation_assignments").upsert(
    {
      rotation_plan_id: parsed.rotationPlanId,
      class_id: parsed.classId,
      room_id: parsed.roomId,
      start_time: parsed.startTime,
      end_time: parsed.endTime || null,
      day_group: parsed.dayGroup,
    },
    {
      onConflict: "rotation_plan_id,class_id",
    },
  );

  if (error) {
    console.error("[ROOM ROTATION] save assignment error", error);
  }

  revalidatePath("/rodizio-salas");
  redirect(`/rodizio-salas?${buildRoomRotationQuery(parsed)}`);
}

export async function saveRoomRotationAssignmentDrop(input: {
  rotationPlanId: string;
  classId: string;
  roomId: string;
  startTime: string;
  endTime?: string | null;
  dayGroup: "SEG_QUA" | "TER_QUI" | "SEX" | "SAB";
}) {
  const parsed = z
    .object({
      rotationPlanId: z.string().uuid(),
      classId: z.string().uuid(),
      roomId: z.string().uuid(),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .nullable()
        .optional(),
      dayGroup: dayGroupSchema,
    })
    .parse(input);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("room_rotation_assignments")
    .upsert(
      {
        rotation_plan_id: parsed.rotationPlanId,
        class_id: parsed.classId,
        room_id: parsed.roomId,
        start_time: parsed.startTime,
        end_time: parsed.endTime || null,
        day_group: parsed.dayGroup,
      },
      {
        onConflict: "rotation_plan_id,class_id",
      },
    )
    .select("id, rotation_plan_id, class_id, room_id, start_time, end_time, day_group, sort_order, notes")
    .single();

  if (error || !data) {
    console.error("[ROOM ROTATION] drop save error", error);
    return {
      status: "failed" as const,
      message: error?.message ?? "Não foi possível salvar a alocação.",
    };
  }

  revalidatePath("/rodizio-salas");

  return {
    status: "saved" as const,
    assignment: data,
  };
}

export async function deleteRoomRotationAssignment(formData: FormData) {
  const filters = parseFilters(formData);
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const supabase = createAdminClient();

  if (assignmentId) {
    const { error } = await supabase
      .from("room_rotation_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      console.error("[ROOM ROTATION] delete assignment error", error);
    }
  }

  revalidatePath("/rodizio-salas");
  redirect(`/rodizio-salas?${buildRoomRotationQuery(filters)}`);
}

export async function deleteRoomRotationAssignmentDrop(assignmentId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("room_rotation_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    console.error("[ROOM ROTATION] drop delete error", error);
    return {
      status: "failed" as const,
      message: error.message,
    };
  }

  revalidatePath("/rodizio-salas");

  return {
    status: "deleted" as const,
  };
}

export async function publishRoomRotationPlan(formData: FormData) {
  const filters = parseFilters(formData);
  const rotationPlanId = String(formData.get("rotationPlanId") ?? "");
  const supabase = createAdminClient();

  if (rotationPlanId) {
    const { error } = await supabase
      .from("room_rotation_plans")
      .update({ status: "published" })
      .eq("id", rotationPlanId);

    if (error) {
      console.error("[ROOM ROTATION] publish plan error", error);
    }
  }

  revalidatePath("/rodizio-salas");
  redirect(
    `/rodizio-salas?${buildRoomRotationQuery({ ...filters, status: "published" })}`,
  );
}

export async function copyPreviousRoomRotationPlan(formData: FormData) {
  const filters = parseFilters(formData);
  const sourcePlanId = String(formData.get("sourcePlanId") ?? "");
  const targetPlanId = String(formData.get("rotationPlanId") ?? "");
  const supabase = createAdminClient();

  if (!sourcePlanId || !targetPlanId || sourcePlanId === targetPlanId) {
    redirect(`/rodizio-salas?${buildRoomRotationQuery(filters)}`);
  }

  const { data: sourceAssignments, error: loadError } = await supabase
    .from("room_rotation_assignments")
    .select("class_id, room_id, start_time, end_time, day_group, sort_order, notes")
    .eq("rotation_plan_id", sourcePlanId);

  if (loadError) {
    console.error("[ROOM ROTATION] copy load error", loadError);
    redirect(`/rodizio-salas?${buildRoomRotationQuery(filters)}`);
  }

  const copiedAssignments = (sourceAssignments ?? []).map((assignment) => ({
    rotation_plan_id: targetPlanId,
    class_id: assignment.class_id,
    room_id: assignment.room_id,
    start_time: assignment.start_time,
    end_time: assignment.end_time,
    day_group: filters.dayGroup,
    sort_order: assignment.sort_order ?? 0,
    notes: assignment.notes,
  }));

  if (copiedAssignments.length > 0) {
    await supabase
      .from("room_rotation_assignments")
      .delete()
      .eq("rotation_plan_id", targetPlanId);
    const { error: insertError } = await supabase
      .from("room_rotation_assignments")
      .insert(copiedAssignments);

    if (insertError) {
      console.error("[ROOM ROTATION] copy insert error", insertError);
    }
  }

  revalidatePath("/rodizio-salas");
  redirect(`/rodizio-salas?${buildRoomRotationQuery(filters)}`);
}
