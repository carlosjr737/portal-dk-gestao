import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { createStudent } from "@/features/students/actions";
import {
  StudentForm,
  type GuardianSearchOption,
} from "@/features/students/student-form";

export const dynamic = "force-dynamic";

export default async function NovoAlunoPage() {
  const guardians = await getGuardians();

  return (
    <div>
      <PageHeader
        title="Novo aluno"
        description="Cadastre as informações principais do aluno."
      />
      <StudentForm
        action={createStudent}
        guardians={guardians}
        submitLabel="Criar aluno"
      />
    </div>
  );
}

async function getGuardians(): Promise<GuardianSearchOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("guardians")
      .select("id, full_name, document, phone, email")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Student guardian search load error:", error.message);
      return [];
    }

    return (data ?? []) as GuardianSearchOption[];
  } catch (error) {
    console.error(
      "Student guardian search load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
