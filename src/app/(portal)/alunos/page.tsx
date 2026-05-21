import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { studentStatusOptions } from "@/features/students/schemas";
import { formatDate, formatText } from "@/features/students/formatters";
import { StatusBadge } from "@/features/students/status-badge";
import type { Student } from "@/features/students/types";

type StudentListRow = Student & {
  financialGuardian: {
    full_name: string;
    phone: string | null;
  } | null;
};

type AlunosPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    created?: string;
  }>;
};

export default async function AlunosPage({ searchParams }: AlunosPageProps) {
  const params = await searchParams;
  const search = params?.q?.trim() ?? "";
  const status = params?.status ?? "";
  const created = params?.created ?? "";
  const students = await getStudents(search, status);

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Alunos"
          description="Cadastro, consulta e acompanhamento de alunos."
        />
        <Link
          href="/alunos/novo"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Novo aluno
        </Link>
      </div>

      <form className="mt-6 grid gap-3 rounded-md border border-border bg-white p-4 md:grid-cols-[1fr_220px_auto]">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Buscar por nome</span>
          <input
            name="q"
            defaultValue={search}
            placeholder="Digite o nome do aluno"
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Status</span>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
          >
            <option value="">Todos</option>
            {studentStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90"
          >
            Filtrar
          </button>
          <Link
            href="/alunos"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Limpar
          </Link>
        </div>
      </form>

      {created === "without-financial-guardian" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Aluno criado sem responsável financeiro. Você poderá vincular depois.
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Resp. financeiro</th>
                <th className="px-4 py-3 font-semibold">Telefone resp.</th>
                <th className="px-4 py-3 font-semibold">Telefone</th>
                <th className="px-4 py-3 font-semibold">E-mail</th>
                <th className="px-4 py-3 font-semibold">Nascimento</th>
                <th className="px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.length > 0 ? (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {student.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatText(student.display_name)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={student.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {student.financialGuardian?.full_name ?? "Não informado"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {student.financialGuardian?.phone ?? "Não informado"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatText(student.phone)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatText(student.email)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(student.birth_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/alunos/${student.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/alunos/${student.id}/editar`}
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function getStudents(
  search: string,
  status: string,
): Promise<StudentListRow[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("students")
      .select(
        "id, full_name, display_name, birth_date, document, phone, email, status, notes, created_at, updated_at",
      )
      .order("full_name", { ascending: true });

    if (search) {
      query = query.ilike("full_name", `%${search}%`);
    }

    if (["active", "inactive", "evaluation"].includes(status)) {
      query = query.eq("status", status);
    }

    const [
      { data, error },
      { data: guardianLinks, error: guardianLinksError },
      { data: guardians, error: guardiansError },
    ] = await Promise.all([
      query,
      supabase
        .from("student_guardians")
        .select("student_id, guardian_id")
        .eq("is_financial_responsible", true),
      supabase.from("guardians").select("id, full_name, phone"),
    ]);

    const firstError = error ?? guardianLinksError ?? guardiansError;

    if (firstError) {
      console.error("Students list load error:", firstError.message);
      return [];
    }

    const guardiansById = new Map(
      (guardians ?? []).map((guardian) => [
        guardian.id as string,
        {
          full_name: guardian.full_name as string,
          phone: (guardian.phone as string | null) ?? null,
        },
      ]),
    );
    const financialGuardianByStudent = new Map<string, StudentListRow["financialGuardian"]>();

    for (const link of guardianLinks ?? []) {
      const studentId = link.student_id as string | null;
      const guardian = guardiansById.get(link.guardian_id as string);

      if (studentId && guardian && !financialGuardianByStudent.has(studentId)) {
        financialGuardianByStudent.set(studentId, guardian);
      }
    }

    return ((data ?? []) as Student[]).map((student) => ({
      ...student,
      financialGuardian: financialGuardianByStudent.get(student.id) ?? null,
    }));
  } catch (error) {
    console.error(
      "Students list load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
