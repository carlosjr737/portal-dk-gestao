import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { createClass } from "@/features/classes/actions";
import { ClassForm } from "@/features/classes/class-form";
import type { CatalogOption } from "@/features/class-catalog/types";
import type { TeacherOption } from "@/features/staff/types";

export const dynamic = "force-dynamic";

export default async function NovaTurmaPage() {
  const [teachers, modalities, levels] = await Promise.all([
    getActiveTeachers(),
    getActiveModalities(),
    getActiveLevels(),
  ]);

  return (
    <div>
      <PageHeader
        title="Nova turma"
        description="Cadastre os dados operacionais da turma."
      />
      <ClassForm
        action={createClass}
        teachers={teachers}
        modalities={modalities}
        levels={levels}
        submitLabel="Criar turma"
        hideName
      />
    </div>
  );
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
      console.error("Modalities select load error:", error.message);
      return [];
    }

    return (data ?? []) as CatalogOption[];
  } catch (error) {
    console.error(
      "Modalities select load error:",
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
      console.error("Levels select load error:", error.message);
      return [];
    }

    return (data ?? []) as CatalogOption[];
  } catch (error) {
    console.error(
      "Levels select load error:",
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
      console.error("Teachers select load error:", error.message);
      return [];
    }

    return (data ?? []) as TeacherOption[];
  } catch (error) {
    console.error(
      "Teachers select load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
