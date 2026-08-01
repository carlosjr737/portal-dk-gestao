import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  formatCapacity,
  formatClassSchedules,
} from "@/features/classes/formatters";
import { DeleteClassButton } from "@/features/classes/delete-class-button";
import { ClassStatusBadge } from "@/features/classes/status-badge";
import type {
  ClassSchedule,
  DanceClass,
  DanceClassWithActiveEnrollments,
} from "@/features/classes/types";
import type { CatalogOption } from "@/features/class-catalog/types";
import { getStaffDisplayName } from "@/features/staff/formatters";
import type { TeacherOption } from "@/features/staff/types";
import { formatText } from "@/features/students/formatters";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type TurmasPageProps = {
  searchParams?: Promise<{
    q?: string;
    classAction?: string;
  }>;
};

export default async function TurmasPage({ searchParams }: TurmasPageProps) {
  const params = await searchParams;
  const search = params?.q?.trim() ?? "";
  const classAction = params?.classAction;
  const classes = await getClasses(search);

  return (
    <div>
      <PageHeader
        title="Turmas"
        description="Cadastro, consulta e acompanhamento de ocupação das turmas."
        actions={
          <>
            <Link
              href="/turmas/novo"
              className={buttonVariants()}
            >
              Nova turma
            </Link>
          </>
        }
      />

      <form className="mt-6 grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-[1fr_auto]">
        {classAction ? (
          <Alert tone="success" className="md:col-span-2">
            {classAction === "deleted"
              ? "Turma excluída definitivamente."
              : "Turma arquivada e removida da listagem principal."}
          </Alert>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Buscar por nome, modalidade, nível ou professor
          </span>
          <Input
            name="q"
            defaultValue={search}
            placeholder="Digite sua busca"
            className="mt-1 py-2"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:opacity-90"
          >
            Buscar
          </button>
          <Link
            href="/turmas"
            className={buttonVariants({ variant: "outline" })}
          >
            Limpar
          </Link>
        </div>
      </form>

      <Table
        containerClassName="mt-6"
        minWidth="820px"
      >
        <TableHeader>
          <TableRow>
            <TableHead>Turma</TableHead>
            <TableHead>Professor</TableHead>
            <TableHead>Horários</TableHead>
            <TableHead>Ocupação</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.length > 0 ? (
            classes.map((danceClass) => (
              <TableRow key={danceClass.id}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {danceClass.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatText(
                      danceClass.modality?.name ?? danceClass.category,
                    )}
                    {" · "}
                    {formatText(danceClass.levelOption?.name ?? null)}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {danceClass.teacher
                    ? getStaffDisplayName(danceClass.teacher)
                    : formatText(danceClass.instructor_name)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatClassSchedules(danceClass.schedules)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {danceClass.active_enrollments_count} /{" "}
                  {formatCapacity(danceClass.capacity)}
                </TableCell>
                <TableCell>
                  <ClassStatusBadge
                    status={danceClass.status}
                    capacity={danceClass.capacity}
                    activeEnrollmentsCount={
                      danceClass.active_enrollments_count
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Link
                      href={`/turmas/${danceClass.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/turmas/${danceClass.id}/editar`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      Editar
                    </Link>
                    <DeleteClassButton
                      classId={danceClass.id}
                      className={danceClass.name}
                      enrollmentsCount={danceClass.total_enrollments_count}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableEmpty colSpan={6}>Nenhuma turma encontrada.</TableEmpty>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

async function getClasses(
  search: string,
): Promise<DanceClassWithActiveEnrollments[]> {
  try {
    const supabase = await createClient();
    const query = supabase
      .from("classes")
      .select(
        "id, name, category, modality_id, level_id, teacher_id, instructor_name, schedule_description, capacity, status, notes, created_at, updated_at",
      )
      .neq("status", "inactive")
      .order("name", { ascending: true });

    const [
      { data: classes, error: classesError },
      { data: enrollments, error: enrollmentsError },
      { data: schedules, error: schedulesError },
      { data: teachers, error: teachersError },
      { data: modalities, error: modalitiesError },
      { data: levels, error: levelsError },
    ] = await Promise.all([
      query,
      supabase.from("enrollments").select("class_id, status"),
      supabase
        .from("class_schedules")
        .select("id, class_id, weekday, start_time, end_time, room, created_at, updated_at"),
      supabase
        .from("staff_members")
        .select("id, full_name, artistic_name")
        .eq("role", "professor"),
      supabase.from("modalities").select("id, name"),
      supabase.from("levels").select("id, name"),
    ]);

    if (classesError || enrollmentsError) {
      console.error(
        "Classes list load error:",
        classesError?.message ?? enrollmentsError?.message,
      );
      return [];
    }

    if (schedulesError) {
      console.error("Class schedules list load error:", schedulesError.message);
    }

    if (teachersError) {
      console.error("Teachers list load error:", teachersError.message);
    }

    if (modalitiesError) {
      console.error("Modalities list load error:", modalitiesError.message);
    }

    if (levelsError) {
      console.error("Levels list load error:", levelsError.message);
    }

    const activeEnrollmentsByClass = new Map<string, number>();
    const totalEnrollmentsByClass = new Map<string, number>();
    const schedulesByClass = new Map<string, ClassSchedule[]>();
    const teachersById = new Map(
      ((teachers ?? []) as TeacherOption[]).map((teacher) => [
        teacher.id,
        teacher,
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

    for (const enrollment of enrollments ?? []) {
      const classId = enrollment.class_id as string | null;

      if (classId) {
        totalEnrollmentsByClass.set(
          classId,
          (totalEnrollmentsByClass.get(classId) ?? 0) + 1,
        );

        if ((enrollment.status as string | null) !== "active") {
          continue;
        }

        activeEnrollmentsByClass.set(
          classId,
          (activeEnrollmentsByClass.get(classId) ?? 0) + 1,
        );
      }
    }

    for (const schedule of (schedules ?? []) as ClassSchedule[]) {
      const currentSchedules = schedulesByClass.get(schedule.class_id) ?? [];
      schedulesByClass.set(schedule.class_id, [...currentSchedules, schedule]);
    }

    return ((classes ?? []) as DanceClass[])
      .map((danceClass) => {
        const teacher = danceClass.teacher_id
          ? teachersById.get(danceClass.teacher_id) ?? null
          : null;
        const modality = danceClass.modality_id
          ? modalitiesById.get(danceClass.modality_id) ?? null
          : null;
        const levelOption = danceClass.level_id
          ? levelsById.get(danceClass.level_id) ?? null
          : null;

        return {
          ...danceClass,
          active_enrollments_count:
            activeEnrollmentsByClass.get(danceClass.id) ?? 0,
          total_enrollments_count:
            totalEnrollmentsByClass.get(danceClass.id) ?? 0,
          schedules: schedulesByClass.get(danceClass.id) ?? [],
          teacher,
          modality,
          levelOption,
        };
      })
      .filter((danceClass) => {
        if (!search) {
          return true;
        }

        const normalizedSearch = search.toLocaleLowerCase("pt-BR");
        const teacherName = danceClass.teacher
          ? getStaffDisplayName(danceClass.teacher)
          : danceClass.instructor_name;

        return [
          danceClass.name,
          danceClass.modality?.name ?? danceClass.category,
          danceClass.levelOption?.name ?? null,
          teacherName,
          danceClass.instructor_name,
        ].some((value) =>
          value?.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
        );
      });
  } catch (error) {
    console.error(
      "Classes list load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
