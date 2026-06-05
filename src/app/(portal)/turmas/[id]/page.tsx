import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  formatCapacity,
  formatClassSchedules,
} from "@/features/classes/formatters";
import { ClassStatusBadge } from "@/features/classes/status-badge";
import { DeleteClassButton } from "@/features/classes/delete-class-button";
import type {
  ClassSchedule,
  DanceClass,
  DanceClassWithActiveEnrollments,
} from "@/features/classes/types";
import type { CatalogOption } from "@/features/class-catalog/types";
import {
  ClassEnrollmentsSection,
  type ClassEnrollmentItem,
} from "@/features/enrollments/class-enrollments-section";
import type { EnrollmentStatus } from "@/features/enrollments/schemas";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { TeacherOption } from "@/features/staff/types";
import {
  formatDateTime,
  formatText,
} from "@/features/students/formatters";

type TurmaDetalhePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TurmaDetalhePage({
  params,
}: TurmaDetalhePageProps) {
  const { id } = await params;
  const [danceClass, enrollments] = await Promise.all([
    getClass(id),
    getClassEnrollments(id),
  ]);

  if (!danceClass) {
    notFound();
  }

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title={danceClass.name}
          description="Detalhes operacionais da turma."
        />
        <div className="flex gap-2">
          <Link
            href="/turmas"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Voltar
          </Link>
          <Link
            href={`/turmas/${danceClass.id}/editar`}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Editar
          </Link>
          <span className="inline-flex h-10 items-center rounded-md border border-rose-200 px-4">
            <DeleteClassButton
              classId={danceClass.id}
              className={danceClass.name}
              enrollmentsCount={danceClass.total_enrollments_count}
              redirectOnSuccess
            />
          </span>
        </div>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <InfoCard label="Status">
          <ClassStatusBadge
            status={danceClass.status}
            capacity={danceClass.capacity}
            activeEnrollmentsCount={danceClass.active_enrollments_count}
          />
        </InfoCard>
        <InfoCard label="Matrículas ativas">
          {danceClass.active_enrollments_count}
        </InfoCard>
        <InfoCard label="Capacidade">
          {formatCapacity(danceClass.capacity)}
        </InfoCard>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <InfoCard label="Professor">
          {danceClass.teacher
            ? getStaffDisplayName(danceClass.teacher)
            : formatText(danceClass.instructor_name)}
        </InfoCard>
        <InfoCard label="Modalidade">
          {formatText(danceClass.modality?.name ?? danceClass.category)}
        </InfoCard>
        <InfoCard label="Nível">
          {formatText(danceClass.levelOption?.name ?? null)}
        </InfoCard>
        <InfoCard label="Horários">
          {formatClassSchedules(danceClass.schedules)}
        </InfoCard>
      </section>

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">Observações</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {formatText(danceClass.notes)}
        </p>
      </section>

      <ClassEnrollmentsSection enrollments={enrollments} />

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoCard label="Criada em">
          {formatDateTime(danceClass.created_at)}
        </InfoCard>
        <InfoCard label="Atualizada em">
          {formatDateTime(danceClass.updated_at)}
        </InfoCard>
      </section>
    </div>
  );
}

async function getClass(
  id: string,
): Promise<DanceClassWithActiveEnrollments | null> {
  try {
    const supabase = await createClient();
    const [
      { data, error },
      { count, error: countError },
      { count: totalCount, error: totalCountError },
      { data: schedules, error: schedulesError },
      { data: teacher, error: teacherError },
      { data: modalities, error: modalitiesError },
      { data: levels, error: levelsError },
    ] = await Promise.all([
      supabase
        .from("classes")
        .select(
          "id, name, category, modality_id, level_id, teacher_id, instructor_name, schedule_description, capacity, status, notes, created_at, updated_at",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", id)
        .eq("status", "active"),
      supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", id),
      supabase
        .from("class_schedules")
        .select("id, class_id, weekday, start_time, end_time, room, created_at, updated_at")
        .eq("class_id", id),
      supabase
        .from("staff_members")
        .select("id, full_name, artistic_name")
        .eq("role", "professor"),
      supabase.from("modalities").select("id, name"),
      supabase.from("levels").select("id, name"),
    ]);

    if (error || countError || totalCountError) {
      console.error(
        "Class detail load error:",
        error?.message ?? countError?.message ?? totalCountError?.message,
      );
      return null;
    }

    if (schedulesError) {
      console.error("Class schedules detail load error:", schedulesError.message);
    }

    if (teacherError) {
      console.error("Teacher detail load error:", teacherError.message);
    }

    if (modalitiesError) {
      console.error("Modalities detail load error:", modalitiesError.message);
    }

    if (levelsError) {
      console.error("Levels detail load error:", levelsError.message);
    }

    if (!data) {
      return null;
    }

    const teachersById = new Map(
      ((teacher ?? []) as TeacherOption[]).map((staffMember) => [
        staffMember.id,
        staffMember,
      ]),
    );
    const modalitiesById = new Map(
      ((modalities ?? []) as CatalogOption[]).map((modality) => [
        modality.id,
        modality,
      ]),
    );
    const levelsById = new Map(
      ((levels ?? []) as CatalogOption[]).map((level) => [level.id, level]),
    );
    const danceClass = data as DanceClass;

    return {
      ...danceClass,
      active_enrollments_count: count ?? 0,
      total_enrollments_count: totalCount ?? 0,
      schedules: ((schedules ?? []) as ClassSchedule[]),
      teacher: danceClass.teacher_id
        ? teachersById.get(danceClass.teacher_id) ?? null
        : null,
      modality: danceClass.modality_id
        ? modalitiesById.get(danceClass.modality_id) ?? null
        : null,
      levelOption: danceClass.level_id
        ? levelsById.get(danceClass.level_id) ?? null
        : null,
    };
  } catch (error) {
    console.error(
      "Class detail load error:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function getClassEnrollments(
  classId: string,
): Promise<ClassEnrollmentItem[]> {
  try {
    const supabase = await createClient();
    const [
      { data: enrollments, error },
      { data: students, error: studentsError },
      { data: guardians, error: guardiansError },
    ] = await Promise.all([
      supabase
        .from("enrollments")
        .select(
          "id, student_id, status, start_date, end_date, financial_guardian_id, monthly_amount, discount_amount",
        )
        .eq("class_id", classId)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase.from("students").select("id, full_name"),
      supabase.from("guardians").select("id, full_name"),
    ]);

    const firstError = error ?? studentsError ?? guardiansError;

    if (firstError) {
      console.error("Class enrollments load error:", firstError.message);
      return [];
    }

    const studentsById = new Map(
      (students ?? []).map((student) => [
        student.id as string,
        { id: student.id as string, full_name: student.full_name as string },
      ]),
    );
    const guardiansById = new Map(
      (guardians ?? []).map((guardian) => [
        guardian.id as string,
        guardian.full_name as string,
      ]),
    );

    return (enrollments ?? []).flatMap((enrollment) => {
      const student = studentsById.get(enrollment.student_id as string);

      if (!student) {
        return [];
      }

      return {
        id: enrollment.id as string,
        status: enrollment.status as EnrollmentStatus,
        start_date: (enrollment.start_date as string | null) ?? null,
        end_date: (enrollment.end_date as string | null) ?? null,
        financialGuardianName:
          guardiansById.get(enrollment.financial_guardian_id as string) ?? null,
        monthlyAmount: (enrollment.monthly_amount as number | null) ?? null,
        discountAmount: (enrollment.discount_amount as number | null) ?? null,
        student,
      };
    });
  } catch (error) {
    console.error(
      "Class enrollments load error:",
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
