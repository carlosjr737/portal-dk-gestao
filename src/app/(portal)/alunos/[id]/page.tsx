import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  StudentEnrollmentsSection,
  type StudentEnrollmentItem,
} from "@/features/enrollments/student-enrollments-section";
import type { EnrollmentStatus } from "@/features/enrollments/schemas";
import {
  formatDate,
  formatDateTime,
  formatText,
} from "@/features/students/formatters";
import { StatusBadge } from "@/features/students/status-badge";
import type { Student } from "@/features/students/types";

type AlunoDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AlunoDetalhePage({
  params,
}: AlunoDetalhePageProps) {
  const { id } = await params;
  const [student, guardians, enrollments] = await Promise.all([
    getStudent(id),
    getStudentGuardians(id),
    getStudentEnrollments(id),
  ]);

  if (!student) {
    notFound();
  }

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title={student.full_name}
          description="Detalhes cadastrais do aluno."
        />
        <div className="flex gap-2">
          <Link
            href="/alunos"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Voltar
          </Link>
          <Link
            href={`/alunos/${student.id}/editar`}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Editar
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <InfoCard label="Status">
          <StatusBadge status={student.status} />
        </InfoCard>
        <InfoCard label="Nome social ou artístico">
          {formatText(student.display_name)}
        </InfoCard>
        <InfoCard label="Data de nascimento">
          {formatDate(student.birth_date)}
        </InfoCard>
        <InfoCard label="Documento">{formatText(student.document)}</InfoCard>
        <InfoCard label="Telefone">{formatText(student.phone)}</InfoCard>
        <InfoCard label="E-mail">{formatText(student.email)}</InfoCard>
      </section>

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">Observações</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {formatText(student.notes)}
        </p>
      </section>

      <section className="mt-6 space-y-6">
        <div className="rounded-md border border-border bg-white">
          <div className="border-b border-border p-5">
            <h2 className="text-base font-semibold text-foreground">
              Responsáveis vinculados
            </h2>
          </div>
          <div className="divide-y divide-border">
            {guardians.length > 0 ? (
              guardians.map((link) => (
                <div key={link.id} className="p-5">
                  <Link
                    href={`/responsaveis/${link.guardian.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {link.guardian.full_name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatRelationship(link.relationship_type)}
                    {link.guardian.phone ? ` · ${link.guardian.phone}` : ""}
                  </p>
                  {link.isFinancialGuardian ? (
                    <span className="mt-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      Responsável financeiro
                    </span>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                Nenhum responsável vinculado.
              </p>
            )}
          </div>
        </div>

        <StudentEnrollmentsSection
          enrollments={enrollments.items}
          loadError={enrollments.error}
        />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoCard label="Criado em">{formatDateTime(student.created_at)}</InfoCard>
        <InfoCard label="Atualizado em">
          {formatDateTime(student.updated_at)}
        </InfoCard>
      </section>
    </div>
  );
}

type StudentGuardianLink = {
  id: string;
  relationship_type: string | null;
  is_primary: boolean;
  isFinancialGuardian: boolean;
  guardian: {
    id: string;
    full_name: string;
    phone: string | null;
  };
};

type StudentEnrollmentsResult = {
  items: StudentEnrollmentItem[];
  error: string | null;
};

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
      console.error("Student detail load error:", error.message);
      return null;
    }

    return data as Student | null;
  } catch (error) {
    console.error(
      "Student detail load error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function getStudentGuardians(
  studentId: string,
): Promise<StudentGuardianLink[]> {
  try {
    const supabase = await createClient();
    const { data: links, error } = await supabase
      .from("student_guardians")
      .select(
        "id, guardian_id, relationship_type, relationship, is_primary, is_financial_responsible, is_primary_contact, guardian:guardians!student_guardians_guardian_id_fkey(id, full_name, phone)",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Student guardians load error:", error.message);
      return [];
    }

    return (links ?? []).flatMap((link) => {
      const guardian = normalizeGuardianRelation(link.guardian);

      if (!guardian) {
        return [];
      }

      return {
        id: link.id as string,
        relationship_type:
          (link.relationship as string | null) ??
          (link.relationship_type as string | null) ??
          null,
        is_primary: Boolean(link.is_primary),
        isFinancialGuardian: Boolean(link.is_financial_responsible),
        guardian,
      };
    });
  } catch (error) {
    console.error(
      "Student guardians load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function getStudentEnrollments(
  studentId: string,
): Promise<StudentEnrollmentsResult> {
  try {
    const supabase = await createClient();
    const [
      { data: enrollments, error },
      { data: classes, error: classesError },
      { data: guardians, error: guardiansError },
      { data: teachers, error: teachersError },
    ] = await Promise.all([
      supabase
        .from("enrollments")
        .select(
          "id, class_id, status, start_date, end_date, financial_guardian_id, monthly_amount, cancellation_reason, cancellation_notes, cancelled_at",
        )
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase.from("classes").select("id, name, category, teacher_id, instructor_name"),
      supabase.from("guardians").select("id, full_name"),
      supabase.from("staff_members").select("id, full_name, artistic_name"),
    ]);

    const firstError = error ?? classesError ?? guardiansError ?? teachersError;

    if (firstError) {
      console.error("Student enrollments load error:", firstError);
      return {
        items: [],
        error: firstError.message,
      };
    }

    const teachersById = new Map(
      (teachers ?? []).map((teacher) => [
        teacher.id as string,
        {
          full_name: teacher.full_name as string,
          artistic_name: (teacher.artistic_name as string | null) ?? null,
        },
      ]),
    );
    const classesById = new Map(
      (classes ?? []).map((danceClass) => {
        const teacher =
          typeof danceClass.teacher_id === "string"
            ? teachersById.get(danceClass.teacher_id)
            : null;

        return [
          danceClass.id as string,
          {
            id: danceClass.id as string,
            name: danceClass.name as string,
            category: (danceClass.category as string | null) ?? null,
            teacherName: teacher
              ? teacher.artistic_name || teacher.full_name
              : ((danceClass.instructor_name as string | null) ?? null),
          },
        ];
      }),
    );
    const guardiansById = new Map(
      (guardians ?? []).map((guardian) => [
        guardian.id as string,
        guardian.full_name as string,
      ]),
    );

    const items = (enrollments ?? []).flatMap((enrollment) => {
      const danceClass = classesById.get(enrollment.class_id as string);

      if (!danceClass) {
        return [];
      }

      return {
        id: enrollment.id as string,
        status: enrollment.status as EnrollmentStatus,
        start_date: (enrollment.start_date as string | null) ?? null,
        end_date: (enrollment.end_date as string | null) ?? null,
        monthly_amount:
          typeof enrollment.monthly_amount === "number"
            ? enrollment.monthly_amount
            : enrollment.monthly_amount
              ? Number(enrollment.monthly_amount)
              : null,
        financialGuardianName:
          guardiansById.get(enrollment.financial_guardian_id as string) ?? null,
        cancellation_reason:
          (enrollment.cancellation_reason as string | null) ?? null,
        cancellation_notes:
          (enrollment.cancellation_notes as string | null) ?? null,
        cancelled_at: (enrollment.cancelled_at as string | null) ?? null,
        class: danceClass,
      };
    });

    return {
      items,
      error: null,
    };
  } catch (error) {
    console.error(
      "Student enrollments load error:",
      error instanceof Error ? error.message : error,
    );
    return {
      items: [],
      error: error instanceof Error ? error.message : "Erro inesperado.",
    };
  }
}

function normalizeGuardianRelation(
  value: unknown,
): StudentGuardianLink["guardian"] | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  const guardian = value as {
    id?: unknown;
    full_name?: unknown;
    phone?: unknown;
  };

  if (typeof guardian.id !== "string" || typeof guardian.full_name !== "string") {
    return null;
  }

  return {
    id: guardian.id,
    full_name: guardian.full_name,
    phone: typeof guardian.phone === "string" ? guardian.phone : null,
  };
}

function formatRelationship(relationship: string | null) {
  const labels: Record<string, string> = {
    mother: "Mãe",
    father: "Pai",
    family: "Familiar",
    financial: "Financeiro",
    pedagogical: "Pedagógico",
    emergency: "Emergência",
    other: "Outro",
  };

  return relationship ? labels[relationship] ?? relationship : "Não definido";
}

type InfoCardProps = {
  label: string;
  children: React.ReactNode;
};

function InfoCard({ label, children }: InfoCardProps) {
  return (
    <div className="rounded-md border border-border bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}
