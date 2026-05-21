import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { updateStudent } from "@/features/students/actions";
import { StudentForm } from "@/features/students/student-form";
import type { Student } from "@/features/students/types";

type EditarAlunoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarAlunoPage({ params }: EditarAlunoPageProps) {
  const { id } = await params;
  const student = await getStudent(id);

  if (!student) {
    notFound();
  }

  const updateStudentWithId = updateStudent.bind(null, student.id);

  return (
    <div>
      <PageHeader
        title="Editar aluno"
        description={`Atualize o cadastro de ${student.full_name}.`}
      />
      <StudentForm
        action={updateStudentWithId}
        defaultValues={student}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}

async function getStudent(id: string): Promise<Student | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .select(
        "id, full_name, display_name, birth_date, document, phone, email, status, notes, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Student edit load error:", error.message);
      return null;
    }

    return data as Student | null;
  } catch (error) {
    console.error(
      "Student edit load error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
