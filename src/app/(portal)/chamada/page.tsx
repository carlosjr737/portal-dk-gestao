import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  getAttendanceClasses,
  getAttendanceFilterOptions,
  normalizeAttendanceMonth,
  weekdayOptions,
  type AttendanceFilters,
} from "@/features/attendance/data";
import { buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type ChamadaPageProps = {
  searchParams?: Promise<{
    teacherId?: string;
    modalityId?: string;
    levelId?: string;
    weekday?: string;
    status?: string;
    classId?: string;
    month?: string;
  }>;
};

export default async function ChamadaPage({ searchParams }: ChamadaPageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const [filterOptions, classes] = await Promise.all([
    getAttendanceFilterOptions(),
    getAttendanceClasses(filters),
  ]);
  const printAllHref = `/chamada/imprimir-todas${buildQueryString(filters)}`;

  return (
    <div>
      <PageHeader
        title="Lista de chamada"
        description="Gere e imprima listas de chamada por turma ou por professor."
        actions={
          <>
            <Link
              href={printAllHref}
              className={buttonVariants({ variant: "secondary" })}
            >
              Imprimir todas
            </Link>
          </>
        }
      />

      <form className="mt-6 grid gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-3 xl:grid-cols-7">
        <Field label="Professor">
          <Select name="teacherId" defaultValue={filters.teacherId}>
            <option value="">Todos</option>
            {filterOptions.teachers.length > 0 ? (
              filterOptions.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.artistic_name?.trim() || teacher.full_name}
                </option>
              ))
            ) : (
              <option value="" disabled>
                Nenhum professor cadastrado
              </option>
            )}
          </Select>
        </Field>

        <label className="block">
          <span className="text-sm font-medium text-foreground">Mês/Ano</span>
          <Input
            name="month"
            type="month"
            defaultValue={filters.month}
            className="mt-1"
          />
        </label>

        <Field label="Turma">

          <Select name="classId" defaultValue={filters.classId}>
            <option value="">Todas</option>
            {classes.map((danceClass) => (
              <option key={danceClass.id} value={danceClass.id}>
                {danceClass.name}
              </option>
            ))}

          </Select>

        </Field>

        <Field label="Modalidade">


          <Select name="modalityId" defaultValue={filters.modalityId}>
            <option value="">Todas</option>
            {filterOptions.modalities.map((modality) => (
              <option key={modality.id} value={modality.id}>
                {modality.name}
              </option>
            ))}


          </Select>


        </Field>

        <Field label="Nível">


          <Select name="levelId" defaultValue={filters.levelId}>
            <option value="">Todos</option>
            {filterOptions.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}


          </Select>


        </Field>

        <Field label="Dia da semana">


          <Select name="weekday" defaultValue={filters.weekday}>
            <option value="">Todos</option>
            {weekdayOptions.map((weekday) => (
              <option key={weekday.value} value={weekday.value}>
                {weekday.label}
              </option>
            ))}


          </Select>


        </Field>

        <Field label="Status da turma">


          <Select name="status" defaultValue={filters.status}>
            <option value="active">Ativa</option>
            <option value="planning">Em planejamento</option>


          </Select>


        </Field>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Filtrar
          </button>
          <Link
            href="/chamada"
            className={buttonVariants({ variant: "outline" })}
          >
            Limpar
          </Link>
        </div>
      </form>

      <section className="mt-6 grid gap-4">
        {classes.length > 0 ? (
          classes.map((danceClass) => (
            <Card key={danceClass.id}
              className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {danceClass.name}
                  </h2>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                    <Info label="Professor" value={danceClass.teacherName} />
                    <Info label="Modalidade" value={danceClass.modalityName} />
                    <Info label="Nível" value={danceClass.levelName} />
                    <Info label="Horários" value={danceClass.schedulesText} />
                    <Info
                      label="Alunos ativos"
                      value={String(danceClass.activeStudentsCount)}
                    />
                  </dl>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/chamada/${danceClass.id}${buildMonthQueryString(filters)}`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Ver chamada
                  </Link>
                  <Link
                    href={`/chamada/${danceClass.id}${buildMonthQueryString(filters)}`}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Imprimir
                  </Link>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
            {filters.teacherId
              ? "Este professor não possui turmas cadastradas."
              : "Nenhuma turma encontrada para os filtros selecionados."}
          </Card>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function parseFilters(params?: {
  teacherId?: string;
  modalityId?: string;
  levelId?: string;
  weekday?: string;
  status?: string;
  classId?: string;
  month?: string;
}): AttendanceFilters {
  return {
    classId: params?.classId || undefined,
    teacherId: params?.teacherId || undefined,
    modalityId: params?.modalityId || undefined,
    levelId: params?.levelId || undefined,
    weekday: weekdayOptions.some((option) => option.value === params?.weekday)
      ? (params?.weekday as AttendanceFilters["weekday"])
      : undefined,
    status: params?.status === "planning" ? "planning" : "active",
    month: normalizeAttendanceMonth(params?.month),
  };
}

function buildQueryString(filters: AttendanceFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function buildMonthQueryString(filters: AttendanceFilters) {
  const params = new URLSearchParams();

  if (filters.month) {
    params.set("month", filters.month);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
