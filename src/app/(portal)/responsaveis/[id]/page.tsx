import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ensureContaAzulGuardianLinkAction } from "@/features/finance/conta-azul/guardian-link-actions";
import { ContaAzulGuardianLinkForm } from "@/features/finance/conta-azul/guardian-link-form";
import {
  linkGuardianToStudent,
} from "@/features/guardians/actions";
import { LinkStudentForm } from "@/features/guardians/link-student-form";
import { RelationshipBadge } from "@/features/guardians/relationship-badge";
import type {
  Guardian,
  LinkedStudent,
  StudentOption,
} from "@/features/guardians/types";
import {
  formatDateTime,
  formatText,
} from "@/features/students/formatters";
import { StatusBadge } from "@/features/students/status-badge";

type ResponsavelDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ResponsavelDetalhePage({
  params,
}: ResponsavelDetalhePageProps) {
  const { id } = await params;
  const [guardian, students, linkedStudents, profile] = await Promise.all([
    getGuardian(id),
    getStudentOptions(),
    getLinkedStudents(id),
    getCurrentProfile(),
  ]);

  if (!guardian) {
    notFound();
  }

  const linkAction = linkGuardianToStudent.bind(null, guardian.id);
  const contaAzulLinkAction = ensureContaAzulGuardianLinkAction.bind(
    null,
    guardian.id,
  );
  const canManageContaAzulLink = profile?.active && profile.role === "admin";

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title={guardian.full_name}
          description="Detalhes cadastrais e vínculos do responsável."
        />
        <div className="flex gap-2">
          <Link
            href="/responsaveis"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Voltar
          </Link>
          <Link
            href={`/responsaveis/${guardian.id}/editar`}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Editar
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <InfoCard label="Documento">{formatText(guardian.document)}</InfoCard>
        <InfoCard label="Telefone">{formatText(guardian.phone)}</InfoCard>
        <InfoCard label="E-mail">{formatText(guardian.email)}</InfoCard>
      </section>

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">Observações</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {formatText(guardian.notes)}
        </p>
      </section>

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Conta Azul
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vínculo financeiro do responsável com cliente/pessoa no Conta Azul.
            </p>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  ID Conta Azul
                </span>
                <span className="mt-1 block font-medium text-foreground">
                  {formatText(guardian.conta_azul_person_id)}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Última sincronização
                </span>
                <span className="mt-1 block font-medium text-foreground">
                  {formatDateTime(guardian.conta_azul_last_sync_at)}
                </span>
              </div>
            </div>
          </div>
          {canManageContaAzulLink ? (
            <ContaAzulGuardianLinkForm
              action={contaAzulLinkAction}
              hasContaAzulLink={Boolean(guardian.conta_azul_person_id)}
            />
          ) : null}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-md border border-border bg-white">
          <div className="border-b border-border p-5">
            <h2 className="text-base font-semibold text-foreground">
              Alunos vinculados
            </h2>
          </div>
          <div className="divide-y divide-border">
            {linkedStudents.length > 0 ? (
              linkedStudents.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link
                      href={`/alunos/${link.student?.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {link.student?.full_name ?? "Aluno não encontrado"}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {link.student ? (
                        <StatusBadge status={link.student.status} />
                      ) : null}
                      <RelationshipBadge relationship={link.relationship_type} />
                      {link.is_primary ? (
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                          Principal
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                Nenhum aluno vinculado.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border bg-white p-5">
          <h2 className="text-base font-semibold text-foreground">
            Vincular a aluno
          </h2>
          <div className="mt-4">
            <LinkStudentForm action={linkAction} students={students} />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoCard label="Criado em">{formatDateTime(guardian.created_at)}</InfoCard>
        <InfoCard label="Atualizado em">
          {formatDateTime(guardian.updated_at)}
        </InfoCard>
      </section>
    </div>
  );
}

async function getCurrentProfile() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  return getProfileByUserId(user.id);
}

async function getGuardian(id: string): Promise<Guardian | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("guardians")
      .select(
        "id, full_name, document, phone, email, notes, conta_azul_person_id, conta_azul_last_sync_at, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Guardian detail load error:", error.message);
      return null;
    }

    return data as Guardian | null;
  } catch (error) {
    console.error(
      "Guardian detail load error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function getStudentOptions(): Promise<StudentOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("students")
      .select("id, full_name, status")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Guardian student options load error:", error.message);
      return [];
    }

    return (data ?? []) as StudentOption[];
  } catch (error) {
    console.error(
      "Guardian student options load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function getLinkedStudents(guardianId: string): Promise<LinkedStudent[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("student_guardians")
      .select(
        "id, relationship_type, is_primary, student:students!student_guardians_student_id_fkey(id, full_name, status)",
      )
      .eq("guardian_id", guardianId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Guardian linked students load error:", error.message);
      return [];
    }

    return (data ?? []) as unknown as LinkedStudent[];
  } catch (error) {
    console.error(
      "Guardian linked students load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
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
