import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { updateClass } from "@/features/classes/actions";
import { ClassForm } from "@/features/classes/class-form";
import type { ClassSchedule, DanceClass } from "@/features/classes/types";
import type { CatalogOption } from "@/features/class-catalog/types";
import type { TeacherOption } from "@/features/staff/types";

type EditarTurmaPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarTurmaPage({ params }: EditarTurmaPageProps) {
  const { id } = await params;
  const [danceClass, teachers, modalities, levels] = await Promise.all([
    getClass(id),
    getActiveTeachers(),
    getActiveModalities(),
    getActiveLevels(),
  ]);

  if (!danceClass) {
    notFound();
  }

  const updateClassWithId = updateClass.bind(null, danceClass.id);

  return (
    <div>
      <PageHeader
        title="Editar turma"
        description={`Atualize os dados de ${danceClass.name}.`}
      />
      <ClassForm
        action={updateClassWithId}
        defaultValues={danceClass}
        teachers={teachers}
        modalities={modalities}
        levels={levels}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}

async function getClass(
  id: string,
): Promise<(DanceClass & { schedules: ClassSchedule[] }) | null> {
  try {
    const supabase = await createClient();
    const [{ data, error }, { data: schedules, error: schedulesError }] =
      await Promise.all([
        supabase
          .from("classes")
          .select(
            "id, name, category, modality_id, level_id, teacher_id, instructor_name, schedule_description, capacity, status, notes, created_at, updated_at",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("class_schedules")
          .select("id, class_id, weekday, start_time, end_time, room, created_at, updated_at")
          .eq("class_id", id),
      ]);

    if (error) {
      console.error("Class edit load error:", error.message);
      return null;
    }

    if (schedulesError) {
      console.error("Class schedules edit load error:", schedulesError.message);
    }

    if (!data) {
      return null;
    }

    return {
      ...(data as DanceClass),
      schedules: (schedules ?? []) as ClassSchedule[],
    };
  } catch (error) {
    console.error(
      "Class edit load error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function getActiveModalities(): Promise<CatalogOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("modalities")
      .select("id, name")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Modalities edit select load error:", error.message);
      return [];
    }

    return (data ?? []) as CatalogOption[];
  } catch (error) {
    console.error(
      "Modalities edit select load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function getActiveLevels(): Promise<CatalogOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("levels")
      .select("id, name")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Levels edit select load error:", error.message);
      return [];
    }

    return (data ?? []) as CatalogOption[];
  } catch (error) {
    console.error(
      "Levels edit select load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function getActiveTeachers(): Promise<TeacherOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("staff_members")
      .select("id, full_name, artistic_name")
      .eq("role", "professor")
      .eq("status", "active")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Teachers edit select load error:", error.message);
      return [];
    }

    return (data ?? []) as TeacherOption[];
  } catch (error) {
    console.error(
      "Teachers edit select load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
