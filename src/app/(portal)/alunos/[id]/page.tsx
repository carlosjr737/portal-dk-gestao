import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ContractLauncher } from "@/features/contracts/contract-launcher";
import { createClient } from "@/lib/supabase/server";
import type { TurmaDestino } from "@/features/enrollments/transfer-enrollment-modal";
import type { ResponsavelOption } from "@/features/enrollments/new-enrollment-modal";
import {
  StudentEnrollmentsSection,
  type StudentEnrollmentItem,
} from "@/features/enrollments/student-enrollments-section";
import type { EnrollmentStatus } from "@/features/enrollments/schemas";
import { getMensalidadesDoAluno } from "@/features/mensalidades/queries";
import { MensalidadesSection } from "@/features/mensalidades/mensalidades-section";
import {
  formatDate,
  formatDateTime,
  formatText,
} from "@/features/students/formatters";
import { StatusBadge } from "@/features/students/status-badge";
import type { Student } from "@/features/students/types";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AlunoDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    created?: string;
  }>;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/*
 * A ficha do aluno é a tela onde a secretaria resolve as três perguntas do
 * atendimento — quem é, em que turma está, e se está pagando. Antes as duas
 * últimas moravam em outras telas, e responder um telefonema custava três
 * navegações.
 *
 * Por isso a página é longa de propósito, e a defesa contra isso é a
 * hierarquia: um resumo que responde tudo em uma linha, um índice para pular
 * direto ao bloco, e quatro seções fechadas em cartão. Abas resolveriam a
 * rolagem, mas esconderiam justamente o cruzamento que se quer aqui — "está
 * em três turmas E deve dois meses" é uma leitura só.
 */
export default async function AlunoDetalhePage({
  params,
  searchParams,
}: AlunoDetalhePageProps) {
  const { id } = await params;
  const justCreated = (await searchParams)?.created === "1";
  const [
    student,
    guardians,
    enrollments,
    turmasDestino,
    mensalidades,
    padroesDeMatricula,
  ] = await Promise.all([
    getStudent(id),
    getStudentGuardians(id),
    getStudentEnrollments(id),
    getTurmasDestino(),
    getMensalidadesDoAluno(id),
    getPadroesDeMatricula(),
  ]);

  if (!student) {
    notFound();
  }

  const turmasAtivas = enrollments.items.filter(
    (e) => e.status === "active",
  ).length;
  const responsaveisOptions: ResponsavelOption[] = guardians.map((link) => ({
    id: link.guardian.id,
    nome: link.guardian.full_name,
  }));

  return (
    <div>
      <PageHeader
        title={student.full_name}
        description="Cadastro, responsáveis, matrículas e mensalidades."
        actions={
          <>
            <Link
              href="/alunos"
              className={buttonVariants({ variant: "outline" })}
            >
              Voltar
            </Link>
            <Link
              href={`/alunos/${student.id}/contrato`}
              className={buttonVariants({ variant: "outline" })}
            >
              Gerar contrato
            </Link>
            <Link
              href={`/alunos/${student.id}/editar`}
              className={buttonVariants()}
            >
              Editar
            </Link>
          </>
        }
      />

      {justCreated ? (
        <ContractLauncher href={`/alunos/${student.id}/contrato?auto=1`} />
      ) : null}

      {/*
        Resumo antes de qualquer detalhe: são as quatro respostas que a pessoa
        no telefone precisa dar sem rolar a página. Um cartão só, e não quatro
        soltos, porque eles se leem juntos — status sem mensalidade não decide
        nada.
      */}
      <Card className="mt-6 grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Resumo label="Situação">
          <StatusBadge status={student.status} />
        </Resumo>
        <Resumo label="Turmas ativas">
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {turmasAtivas}
          </span>
        </Resumo>
        <Resumo label="Mensalidade">
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {mensalidades.mensalidadeAtual > 0
              ? brl.format(mensalidades.mensalidadeAtual)
              : "—"}
          </span>
        </Resumo>
        <Resumo label="Mensalidades em aberto">
          {mensalidades.usaPagamentos ? (
            mensalidades.emAberto > 0 ? (
              <Badge tone="danger">
                {mensalidades.emAberto} ·{" "}
                {brl.format(mensalidades.valorEmAberto)}
              </Badge>
            ) : (
              <Badge tone="success">Em dia</Badge>
            )
          ) : (
            <span className="text-sm text-muted-foreground">
              Cobrança fora do sistema
            </span>
          )}
        </Resumo>
      </Card>

      {/*
        Índice, não abas: o conteúdo continua todo na página (e imprimível),
        mas quem chegou para resolver uma coisa só pula direto.
      */}
      <nav
        aria-label="Seções da ficha"
        className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-3 text-sm"
      >
        <AncoraSecao href="#dados">Dados cadastrais</AncoraSecao>
        <AncoraSecao href="#responsaveis">Responsáveis</AncoraSecao>
        <AncoraSecao href="#matriculas">Matrículas</AncoraSecao>
        {mensalidades.usaPagamentos ? (
          <AncoraSecao href="#financeiro">Financeiro</AncoraSecao>
        ) : null}
      </nav>

      <div className="mt-6 space-y-6">
        <Card id="dados" className="scroll-mt-6 overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Dados cadastrais
            </h2>
          </div>
          <dl className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Dado label="Nome social ou artístico">
              {formatText(student.display_name)}
            </Dado>
            <Dado label="Data de nascimento">
              {formatDate(student.birth_date)}
            </Dado>
            <Dado label="Documento">{formatText(student.document)}</Dado>
            <Dado label="Telefone">{formatText(student.phone)}</Dado>
            <Dado label="E-mail">{formatText(student.email)}</Dado>
          </dl>
          <div className="border-t border-border p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Observações
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {formatText(student.notes)}
            </p>
          </div>
        </Card>

        <Card id="responsaveis" className="scroll-mt-6 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Responsáveis vinculados
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {guardians.length === 0
                  ? "Nenhum responsável vinculado."
                  : `${guardians.length} ${guardians.length === 1 ? "vínculo" : "vínculos"}`}
              </p>
            </div>
            <Link
              href="/responsaveis"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Gerenciar responsáveis
            </Link>
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
                    <Badge tone="success" className="mt-2">
                      Responsável financeiro
                    </Badge>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="p-5">
                <p className="text-sm font-medium text-foreground">
                  Nenhum responsável vinculado.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A matrícula precisa de um responsável financeiro — vincule um
                  antes de matricular.
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="scroll-mt-6">
          <StudentEnrollmentsSection
            enrollments={enrollments.items}
            loadError={enrollments.error}
            alunoNome={student.full_name}
            turmasDestino={turmasDestino}
            novaMatricula={{
              alunoId: student.id,
              alunoNome: student.full_name,
              turmas: turmasDestino,
              responsaveis: responsaveisOptions,
              padroes: padroesDeMatricula,
            }}
          />
        </div>

        {mensalidades.usaPagamentos ? (
          <div className="scroll-mt-6">
            <MensalidadesSection dados={mensalidades} alunoId={student.id} />
          </div>
        ) : null}
      </div>

      {/*
        Datas de auditoria em uma linha, não em dois cartões: elas não são
        informação de atendimento, e dois cartões no fim davam a elas o mesmo
        peso visual do bloco de mensalidades.
      */}
      <p className="mt-6 text-xs text-muted-foreground">
        Criado em {formatDateTime(student.created_at)} · Atualizado em{" "}
        {formatDateTime(student.updated_at)}
      </p>
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

/**
 * Turmas ativas com a ocupação atual, para o modal de troca.
 *
 * A ocupação vai junto porque a pessoa precisa ver se cabe ANTES de escolher
 * — descobrir que lotou só depois de confirmar faria ela desfazer.
 */
async function getTurmasDestino(): Promise<TurmaDestino[]> {
  try {
    const supabase = await createClient();
    const [{ data: classes }, { data: enrollments }] = await Promise.all([
      supabase
        .from("classes")
        .select("id, name, capacity")
        .eq("status", "active")
        .order("name", { ascending: true }),
      supabase.from("enrollments").select("class_id").eq("status", "active"),
    ]);

    const ocupacao = new Map<string, number>();
    for (const e of enrollments ?? []) {
      const k = e.class_id as string | null;
      if (k) ocupacao.set(k, (ocupacao.get(k) ?? 0) + 1);
    }

    return (classes ?? []).map((c) => ({
      id: c.id as string,
      nome: (c.name as string) ?? "Turma sem nome",
      alunosAtivos: ocupacao.get(c.id as string) ?? 0,
      capacidade: (c.capacity as number | null) ?? null,
    }));
  } catch (error) {
    console.error("Turmas de destino:", error);
    return [];
  }
}

/**
 * Datas que o modal de nova matrícula já traz preenchidas.
 *
 * O dia do vencimento é regra DA ESCOLA (dia 5, por exemplo), não do provedor
 * de pagamento — mesma leitura que `/matriculas/nova` faz. Vir preenchido é o
 * que faz a matrícula rápida caber num modal: sobram a turma, o responsável e
 * o valor.
 */
async function getPadroesDeMatricula() {
  const hoje = new Date();
  let diaPadrao = 5;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("finance_provider_settings")
      .select("default_due_day")
      .limit(1)
      .maybeSingle();

    if (typeof data?.default_due_day === "number") {
      diaPadrao = data.default_due_day;
    }
  } catch (error) {
    console.error("Vencimento padrão:", error);
  }

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const diaNoMes = (ano: number, mes: number) =>
    Math.min(diaPadrao, new Date(ano, mes + 1, 0).getDate());

  let vencimento = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    diaNoMes(hoje.getFullYear(), hoje.getMonth()),
  );

  // Vencimento no passado nasceria vencido. Passa para o mês seguinte.
  if (vencimento < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) {
    const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    vencimento = new Date(
      proximo.getFullYear(),
      proximo.getMonth(),
      diaNoMes(proximo.getFullYear(), proximo.getMonth()),
    );
  }

  return {
    inicio: iso(hoje),
    fim: `${hoje.getFullYear()}-12-31`,
    primeiroVencimento: iso(vencimento),
  };
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

function AncoraSecao({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="font-medium text-muted-foreground transition hover:text-foreground"
    >
      {children}
    </a>
  );
}

function Resumo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Dado({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}
