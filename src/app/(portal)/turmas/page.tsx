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
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Turmas"
          description="Cadastro, consulta e acompanhamento de ocupação das turmas."
        />
        <Link
          href="/turmas/novo"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Nova turma
        </Link>
      </div>

      <form className="mt-6 grid gap-3 rounded-md border border-border bg-white p-4 md:grid-cols-[1fr_auto]">
        {classAction ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 md:col-span-2">
            {classAction === "deleted"
              ? "Turma excluída definitivamente."
              : "Turma arquivada e removida da listagem principal."}
          </div>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Buscar por nome, modalidade, nível ou professor
          </span>
          <input
            name="q"
            defaultValue={search}
            placeholder="Digite sua busca"
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
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
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Limpar
          </Link>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Turma</th>
                <th className="px-4 py-3 font-semibold">Professor</th>
                <th className="px-4 py-3 font-semibold">Horários</th>
                <th className="px-4 py-3 font-semibold">Ocupação</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classes.length > 0 ? (
                classes.map((danceClass) => (
                  <tr key={danceClass.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {danceClass.teacher
                        ? getStaffDisplayName(danceClass.teacher)
                        : formatText(danceClass.instructor_name)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatClassSchedules(danceClass.schedules)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {danceClass.active_enrollments_count} /{" "}
                      {formatCapacity(danceClass.capacity)}
                    </td>
                    <td className="px-4 py-3">
                      <ClassStatusBadge
                        status={danceClass.status}
                        capacity={danceClass.capacity}
                        activeEnrollmentsCount={
                          danceClass.active_enrollments_count
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma turma encontrada.
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
