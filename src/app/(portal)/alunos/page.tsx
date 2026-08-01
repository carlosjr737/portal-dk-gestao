import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { studentStatusOptions } from "@/features/students/schemas";
import { formatDate, formatText } from "@/features/students/formatters";
import { StatusBadge } from "@/features/students/status-badge";
import type { Student } from "@/features/students/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableRow,
  TableHead,
  TableHeader,
} from "@/components/ui/table";

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
      <PageHeader
        title="Alunos"
        description="Cadastro, consulta e acompanhamento de alunos."
        actions={
          <>
            <Link
              href="/alunos/novo"
              className={buttonVariants()}
            >
              Novo aluno
            </Link>
          </>
        }
      />

      <form className="mt-6 grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-[1fr_220px_auto]">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Buscar por nome</span>
          <Input
            name="q"
            defaultValue={search}
            placeholder="Digite o nome do aluno"
            className="mt-1 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Status</span>
          <Select
            name="status"
            defaultValue={status}
            className="mt-1 py-2"
          >
            <option value="">Todos</option>
            {studentStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <div className="flex items-end gap-2">
          <Button variant="outline" type="submit">
            Filtrar
          </Button>
          <Link
            href="/alunos"
            className={buttonVariants({ variant: "outline" })}
          >
            Limpar
          </Link>
        </div>
      </form>

      {created === "without-financial-guardian" ? (
        <Alert tone="warning" className="mt-4">
          Aluno criado sem responsável financeiro. Você poderá vincular depois.
        </Alert>
      ) : null}

      <Table
        containerClassName="mt-6"
        minWidth="760px"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Resp. financeiro</TableHead>
            <TableHead>Telefone resp.</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Nascimento</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.length > 0 ? (
            students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {student.full_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatText(student.display_name)}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={student.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {student.financialGuardian?.full_name ?? "Não informado"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {student.financialGuardian?.phone ?? "Não informado"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatText(student.phone)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatText(student.email)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(student.birth_date)}
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={8}>Nenhum aluno encontrado.</TableEmpty>
          )}
        </TableBody>
      </Table>
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
