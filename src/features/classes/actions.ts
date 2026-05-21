"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  classCreateFormSchema,
  classFormSchema,
  getAutomaticClassStatus,
  type ClassCreateFormData,
  type ClassFormData,
} from "@/features/classes/schemas";
import { formatClassSchedules } from "@/features/classes/formatters";

export type ClassActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

export type DeleteOrArchiveClassResult = {
  success: boolean;
  action?: "deleted" | "archived";
  message: string;
};

function classFormDataToObject(formData: FormData) {
  const weekdays = formData.getAll("schedule_weekday").map(String);
  const startTimes = formData.getAll("schedule_start_time").map(String);
  const endTimes = formData.getAll("schedule_end_time").map(String);
  const rooms = formData.getAll("schedule_room").map(String);

  return {
    name: String(formData.get("name") ?? ""),
    teacher_id: String(formData.get("teacher_id") ?? ""),
    modality_id: String(formData.get("modality_id") ?? ""),
    level_id: String(formData.get("level_id") ?? ""),
    capacity: String(formData.get("capacity") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    schedules: weekdays.map((weekday, index) => ({
      weekday,
      start_time: startTimes[index] ?? "",
      end_time: endTimes[index] ?? "",
      room: rooms[index] ?? "",
    })),
  };
}

function buildClassPayload(data: ClassFormData) {
  return {
    name: data.name,
    teacher_id: data.teacher_id,
    modality_id: data.modality_id,
    level_id: data.level_id,
    capacity: data.capacity,
    notes: data.notes,
    status: getAutomaticClassStatus(data),
    schedule_description: formatClassSchedules(data.schedules),
  };
}

function buildSchedulePayload(classId: string, data: ClassFormData) {
  return data.schedules.map((schedule) => ({
    class_id: classId,
    weekday: schedule.weekday,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    room: schedule.room,
  }));
}

const abbreviatedWeekdays: Record<string, string> = {
  segunda: "Seg",
  terca: "Ter",
  quarta: "Qua",
  quinta: "Qui",
  sexta: "Sex",
  sabado: "Sáb",
  domingo: "Dom",
};

function buildAutomaticClassName(
  data: ClassCreateFormData,
  modalityName: string,
  levelName: string,
  teacher: { full_name: string; artistic_name: string | null },
) {
  const teacherName = teacher.artistic_name?.trim() || teacher.full_name;
  const days = data.schedules
    .map((schedule) => abbreviatedWeekdays[schedule.weekday])
    .filter(Boolean)
    .join("/");
  const firstTime = data.schedules[0]?.start_time?.slice(0, 5) ?? "";

  if (!modalityName.trim() || !levelName.trim() || !teacherName.trim() || !days || !firstTime) {
    return "Turma sem nome";
  }

  return `${modalityName} - ${levelName} - ${teacherName} - ${days} ${firstTime}`;
}

export async function createClass(
  _previousState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const parsed = classCreateFormSchema.safeParse(classFormDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const [
    { data: teacher, error: teacherError },
    { data: modality, error: modalityError },
    { data: level, error: levelError },
  ] = await Promise.all([
    supabase
      .from("staff_members")
      .select("id, full_name, artistic_name")
      .eq("id", parsed.data.teacher_id)
      .eq("role", "professor")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("modalities")
      .select("id, name")
      .eq("id", parsed.data.modality_id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("levels")
      .select("id, name")
      .eq("id", parsed.data.level_id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (teacherError || !teacher) {
    return {
      errors: {
        teacher_id: ["Selecione um professor ativo cadastrado."],
      },
      message:
        "Nenhum professor ativo foi encontrado para a turma. Cadastre ou ative um professor antes de continuar.",
    };
  }

  if (modalityError || !modality) {
    return {
      errors: {
        modality_id: ["Selecione uma modalidade ativa cadastrada."],
      },
      message:
        "Nenhuma modalidade ativa foi encontrada. Cadastre ou ative uma modalidade antes de continuar.",
    };
  }

  if (levelError || !level) {
    return {
      errors: {
        level_id: ["Selecione um nível ativo cadastrado."],
      },
      message:
        "Nenhum nível ativo foi encontrado. Cadastre ou ative um nível antes de continuar.",
    };
  }

  const classData: ClassFormData = {
    ...parsed.data,
    name: buildAutomaticClassName(
      parsed.data,
      modality.name,
      level.name,
      teacher,
    ),
  };

  const { data, error } = await supabase
    .from("classes")
    .insert(buildClassPayload(classData))
    .select("id")
    .single();

  if (error || !data) {
    return {
      message: error?.message ?? "Nao foi possivel criar a turma.",
    };
  }

  const { error: schedulesError } = await supabase
    .from("class_schedules")
    .insert(buildSchedulePayload(data.id as string, classData));

  if (schedulesError) {
    return {
      message: schedulesError.message,
    };
  }

  revalidatePath("/turmas");
  redirect(`/turmas/${data.id}`);
}

export async function updateClass(
  classId: string,
  _previousState: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const parsed = classFormSchema.safeParse(classFormDataToObject(formData));

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const [
    { data: teacher, error: teacherError },
    { data: modality, error: modalityError },
    { data: level, error: levelError },
  ] = await Promise.all([
    supabase
      .from("staff_members")
      .select("id")
      .eq("id", parsed.data.teacher_id)
      .eq("role", "professor")
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("modalities")
      .select("id, name")
      .eq("id", parsed.data.modality_id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("levels")
      .select("id, name")
      .eq("id", parsed.data.level_id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (teacherError || !teacher) {
    return {
      errors: {
        teacher_id: ["Selecione um professor ativo cadastrado."],
      },
      message:
        "Nenhum professor ativo foi encontrado para a turma. Cadastre ou ative um professor antes de continuar.",
    };
  }

  if (modalityError || !modality) {
    return {
      errors: {
        modality_id: ["Selecione uma modalidade ativa cadastrada."],
      },
      message:
        "Nenhuma modalidade ativa foi encontrada. Cadastre ou ative uma modalidade antes de continuar.",
    };
  }

  if (levelError || !level) {
    return {
      errors: {
        level_id: ["Selecione um nível ativo cadastrado."],
      },
      message:
        "Nenhum nível ativo foi encontrado. Cadastre ou ative um nível antes de continuar.",
    };
  }

  const { error } = await supabase
    .from("classes")
    .update(buildClassPayload(parsed.data))
    .eq("id", classId);

  if (error) {
    return {
      message: error.message,
    };
  }

  const { error: deleteError } = await supabase
    .from("class_schedules")
    .delete()
    .eq("class_id", classId);

  if (deleteError) {
    return {
      message: deleteError.message,
    };
  }

  const { error: insertError } = await supabase
    .from("class_schedules")
    .insert(buildSchedulePayload(classId, parsed.data));

  if (insertError) {
    return {
      message: insertError.message,
    };
  }

  revalidatePath("/turmas");
  revalidatePath(`/turmas/${classId}`);
  redirect(`/turmas/${classId}`);
}

export async function deleteOrArchiveClass(
  classId: string,
): Promise<DeleteOrArchiveClassResult> {
  const parsed = z.string().uuid().safeParse(classId);

  if (!parsed.success) {
    return {
      success: false,
      message: "Turma inválida.",
    };
  }

  const supabase = await createClient();
  const { data: danceClass, error: classError } = await supabase
    .from("classes")
    .select("id, name, status")
    .eq("id", parsed.data)
    .maybeSingle();

  if (classError || !danceClass) {
    console.error("Class delete/archive load error:", classError);
    return {
      success: false,
      message: "Não foi possível localizar a turma.",
    };
  }

  const { count, error: countError } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", parsed.data);

  if (countError) {
    console.error("Class delete/archive enrollment count error:", countError);
    return {
      success: false,
      message: "Não foi possível verificar as matrículas da turma.",
    };
  }

  if ((count ?? 0) === 0) {
    const { error: schedulesError } = await supabase
      .from("class_schedules")
      .delete()
      .eq("class_id", parsed.data);

    if (schedulesError) {
      console.error("Class schedules delete error:", schedulesError);
      return {
        success: false,
        message: "Não foi possível excluir os horários da turma.",
      };
    }

    const { error: deleteError } = await supabase
      .from("classes")
      .delete()
      .eq("id", parsed.data);

    if (deleteError) {
      console.error("Class delete error:", deleteError);
      return {
        success: false,
        message: "Não foi possível excluir a turma.",
      };
    }

    revalidatePath("/turmas");
    revalidatePath("/dashboard");

    return {
      success: true,
      action: "deleted",
      message: "Turma excluída definitivamente.",
    };
  }

  const { error: archiveError } = await supabase
    .from("classes")
    .update({ status: "inactive" })
    .eq("id", parsed.data);

  if (archiveError) {
    console.error("Class archive error:", archiveError);
    return {
      success: false,
      message: "Não foi possível arquivar a turma.",
    };
  }

  revalidatePath("/turmas");
  revalidatePath(`/turmas/${parsed.data}`);
  revalidatePath("/dashboard");
  revalidatePath("/matriculas/nova");

  return {
    success: true,
    action: "archived",
    message:
      "Turma arquivada para preservar o histórico de matrículas vinculadas.",
  };
}
