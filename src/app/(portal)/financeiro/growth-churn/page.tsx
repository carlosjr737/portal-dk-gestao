import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type GrowthChurnPageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    teacherId?: string;
    modalityId?: string;
    levelId?: string;
    classId?: string;
  }>;
};

type GrowthChurnEvent = {
  id: string;
  event_type: "entrada" | "saida";
  student_id: string | null;
  enrollment_id: string | null;
  class_id: string | null;
  teacher_id: string | null;
  modality_id: string | null;
  level_id: string | null;
  event_date: string;
  monthly_amount: number | null;
  reason_id: string | null;
  reason_notes: string | null;
  source: string;
};

type NamedRecord = {
  id: string;
  name: string;
};

type TeacherRecord = {
  id: string;
  fullName: string;
};

export default async function GrowthChurnPage({
  searchParams,
}: GrowthChurnPageProps) {
  const params = await searchParams;
  const defaultPeriod = getDefaultPeriod();
  const filters = {
    from: params?.from?.trim() || defaultPeriod.from,
    to: params?.to?.trim() || defaultPeriod.to,
    teacherId: params?.teacherId?.trim() ?? "",
    modalityId: params?.modalityId?.trim() ?? "",
    levelId: params?.levelId?.trim() ?? "",
    classId: params?.classId?.trim() ?? "",
  };
  const data = await getGrowthChurnData(filters);
  const activeQuickFilter = getActiveQuickFilter(filters);

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Growth & Churn"
          description="Indicadores de entradas, saídas e impacto financeiro por matrícula."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financeiro"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Financeiro
          </Link>
          <button
            type="button"
            disabled
            className="h-10 cursor-not-allowed rounded-md border border-border bg-muted px-4 text-sm font-medium text-muted-foreground"
          >
            Importar histórico
          </button>
        </div>
      </div>

      <form className="mt-6 grid gap-3 rounded-md border border-border bg-white p-4 lg:grid-cols-6">
        <div className="flex flex-wrap gap-2 lg:col-span-6">
          <QuickFilterLink
            label="Este mês"
            href={buildGrowthChurnHref(getDefaultPeriod())}
            active={activeQuickFilter === "thisMonth"}
          />
          <QuickFilterLink
            label="Mês passado"
            href={buildGrowthChurnHref(getPreviousMonthPeriod())}
            active={activeQuickFilter === "previousMonth"}
          />
          <QuickFilterLink
            label="Este ano"
            href={buildGrowthChurnHref(getCurrentYearPeriod())}
            active={activeQuickFilter === "thisYear"}
          />
          <QuickFilterLink
            label="Limpar"
            href="/financeiro/growth-churn"
            active={false}
          />
        </div>
        <FilterInput label="Período inicial" name="from" type="date" value={filters.from} />
        <FilterInput label="Período final" name="to" type="date" value={filters.to} />
        <FilterSelect
          label="Professor"
          name="teacherId"
          value={filters.teacherId}
          options={data.options.teachers.map((teacher) => ({
            value: teacher.id,
            label: teacher.fullName,
          }))}
        />
        <FilterSelect
          label="Modalidade"
          name="modalityId"
          value={filters.modalityId}
          options={data.options.modalities.map((modality) => ({
            value: modality.id,
            label: modality.name,
          }))}
        />
        <FilterSelect
          label="Nível"
          name="levelId"
          value={filters.levelId}
          options={data.options.levels.map((level) => ({
            value: level.id,
            label: level.name,
          }))}
        />
        <FilterSelect
          label="Turma"
          name="classId"
          value={filters.classId}
          options={data.options.classes.map((danceClass) => ({
            value: danceClass.id,
            label: danceClass.name,
          }))}
        />
        <div className="flex items-end gap-2 lg:col-span-6">
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Filtrar
          </button>
          <Link
            href="/financeiro/growth-churn"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Limpar
          </Link>
        </div>
      </form>

      {data.errorMessage ? (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {data.errorMessage}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Entradas" value={String(data.metrics.entries)} />
        <MetricCard label="Cancelamentos" value={String(data.metrics.exits)} />
        <MetricCard
          label="Saldo líquido de alunos"
          value={String(data.metrics.netStudents)}
        />
        <MetricCard label="Receita nova" value={formatMoney(data.metrics.newRevenue)} />
        <MetricCard
          label="Receita perdida"
          value={formatMoney(data.metrics.lostRevenue)}
        />
        <MetricCard
          label="Saldo líquido financeiro"
          value={formatMoney(data.metrics.netRevenue)}
        />
        <MetricCard
          label="Ticket médio de entrada"
          value={formatMoney(data.metrics.averageEntryTicket)}
        />
        <MetricCard
          label="Ticket médio perdido"
          value={formatMoney(data.metrics.averageLostTicket)}
        />
      </section>

      <p className="mt-4 text-sm text-muted-foreground">
        No período selecionado, houve {data.metrics.entries} entradas e{" "}
        {data.metrics.exits} cancelamentos, com saldo financeiro de{" "}
        {formatMoney(data.metrics.netRevenue)}.
      </p>

      <AnalyticTable
        title="Cancelamentos por motivo"
        headers={["Motivo", "Quantidade", "Receita perdida", "% dos cancelamentos"]}
        rows={data.churnByReason.map((row) => [
          row.reason,
          String(row.quantity),
          formatMoney(row.lostRevenue),
          formatPercent(row.exitShare),
        ])}
      />

      <AnalyticTable
        title="Growth/Churn por professor"
        headers={[
          "Professor",
          "Entradas",
          "Cancelamentos",
          "Saldo",
          "Receita nova",
          "Receita perdida",
          "Saldo financeiro",
        ]}
        rows={data.byTeacher.map((row) => [
          row.name,
          String(row.entries),
          String(row.exits),
          String(row.netStudents),
          formatMoney(row.newRevenue),
          formatMoney(row.lostRevenue),
          formatMoney(row.netRevenue),
        ])}
      />

      <AnalyticTable
        title="Growth/Churn por turma"
        headers={[
          "Turma",
          "Entradas",
          "Cancelamentos",
          "Saldo",
          "Receita nova",
          "Receita perdida",
          "Saldo financeiro",
        ]}
        rows={data.byClass.map((row) => [
          row.name,
          String(row.entries),
          String(row.exits),
          String(row.netStudents),
          formatMoney(row.newRevenue),
          formatMoney(row.lostRevenue),
          formatMoney(row.netRevenue),
        ])}
      />

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Lista de eventos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Aluno</th>
                <th className="px-4 py-3 font-semibold">Turma</th>
                <th className="px-4 py-3 font-semibold">Professor</th>
                <th className="px-4 py-3 font-semibold">Nível</th>
                <th className="px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Motivo</th>
                <th className="px-4 py-3 font-semibold">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.events.length > 0 ? (
                data.events.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(event.event_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {event.event_type === "entrada" ? "Entrada" : "Saída"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {data.maps.students.get(event.student_id ?? "")?.fullName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {data.maps.classes.get(event.class_id ?? "")?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {data.maps.teachers.get(event.teacher_id ?? "")?.fullName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {data.maps.levels.get(event.level_id ?? "")?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatMoney(event.monthly_amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {getEventReasonLabel(event, data.maps.reasons)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatSource(event.source)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum evento de Growth & Churn encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

async function getGrowthChurnData(filters: {
  from: string;
  to: string;
  teacherId: string;
  modalityId: string;
  levelId: string;
  classId: string;
}) {
  const supabase = createAdminClient();
  const appliedFilters = {
    from: filters.from,
    to: filters.to,
    teacherId: isActiveFilter(filters.teacherId) ? filters.teacherId : null,
    modalityId: isActiveFilter(filters.modalityId) ? filters.modalityId : null,
    levelId: isActiveFilter(filters.levelId) ? filters.levelId : null,
    classId: isActiveFilter(filters.classId) ? filters.classId : null,
  };

  console.info("Growth churn filters received:", filters);
  console.info("Growth churn filters applied:", appliedFilters);

  let eventsQuery = supabase
    .from("growth_churn_events")
    .select(
      "id, event_type, student_id, enrollment_id, class_id, teacher_id, modality_id, level_id, event_date, monthly_amount, reason_id, reason_notes, source",
    )
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (appliedFilters.from) {
    eventsQuery = eventsQuery.gte("event_date", appliedFilters.from);
  }

  if (appliedFilters.to) {
    eventsQuery = eventsQuery.lte("event_date", appliedFilters.to);
  }

  if (appliedFilters.teacherId) {
    eventsQuery = eventsQuery.eq("teacher_id", appliedFilters.teacherId);
  }

  if (appliedFilters.modalityId) {
    eventsQuery = eventsQuery.eq("modality_id", appliedFilters.modalityId);
  }

  if (appliedFilters.levelId) {
    eventsQuery = eventsQuery.eq("level_id", appliedFilters.levelId);
  }

  if (appliedFilters.classId) {
    eventsQuery = eventsQuery.eq("class_id", appliedFilters.classId);
  }

  const [
    { data: events, error: eventsError },
    { data: students },
    { data: classes },
    { data: teachers },
    { data: modalities },
    { data: levels },
    { data: reasons },
  ] = await Promise.all([
    eventsQuery,
    supabase.from("students").select("id, full_name"),
    supabase.from("classes").select("id, name"),
    supabase.from("staff_members").select("id, full_name").eq("role", "professor"),
    supabase.from("modalities").select("id, name").order("sort_order"),
    supabase.from("levels").select("id, name").order("sort_order"),
    supabase.from("churn_reasons").select("id, name").order("name"),
  ]);

  if (eventsError) {
    console.error("Growth churn events load error:", eventsError);
  }

  const normalizedEvents = ((events ?? []) as GrowthChurnEvent[]).map((event) => ({
    ...event,
    monthly_amount:
      event.monthly_amount === null ? null : Number(event.monthly_amount),
  }));
  const maps = {
    students: new Map(
      (students ?? []).map((student) => [
        student.id as string,
        { id: student.id as string, fullName: student.full_name as string },
      ]),
    ),
    classes: new Map(
      (classes ?? []).map((danceClass) => [
        danceClass.id as string,
        { id: danceClass.id as string, name: danceClass.name as string },
      ]),
    ),
    teachers: new Map(
      (teachers ?? []).map((teacher) => [
        teacher.id as string,
        { id: teacher.id as string, fullName: teacher.full_name as string },
      ]),
    ),
    modalities: new Map(
      (modalities ?? []).map((modality) => [
        modality.id as string,
        { id: modality.id as string, name: modality.name as string },
      ]),
    ),
    levels: new Map(
      (levels ?? []).map((level) => [
        level.id as string,
        { id: level.id as string, name: level.name as string },
      ]),
    ),
    reasons: new Map(
      (reasons ?? []).map((reason) => [
        reason.id as string,
        { id: reason.id as string, name: reason.name as string },
      ]),
    ),
  };

  const metrics = calculateMetrics(normalizedEvents);

  console.info("Growth churn events loaded:", {
    returnedEvents: normalizedEvents.length,
    entries: metrics.entries,
    exits: metrics.exits,
    newRevenue: metrics.newRevenue,
    lostRevenue: metrics.lostRevenue,
    error: eventsError?.message ?? null,
  });

  return {
    events: normalizedEvents,
    maps,
    options: {
      teachers: [...maps.teachers.values()],
      modalities: [...maps.modalities.values()],
      levels: [...maps.levels.values()],
      classes: [...maps.classes.values()],
    },
    metrics,
    churnByReason: buildChurnByReason(normalizedEvents, maps.reasons),
    byTeacher: buildGroupedRows(normalizedEvents, maps.teachers, "teacher_id"),
    byClass: buildGroupedRows(normalizedEvents, maps.classes, "class_id"),
    errorMessage: eventsError
      ? "Não foi possível carregar os eventos de Growth & Churn."
      : null,
  };
}

function calculateMetrics(events: GrowthChurnEvent[]) {
  const entries = events.filter((event) => event.event_type === "entrada");
  const exits = events.filter((event) => event.event_type === "saida");
  const newRevenue = sumAmounts(entries);
  const lostRevenue = sumAmounts(exits);

  return {
    entries: entries.length,
    exits: exits.length,
    netStudents: entries.length - exits.length,
    newRevenue,
    lostRevenue,
    netRevenue: newRevenue - lostRevenue,
    averageEntryTicket: entries.length ? newRevenue / entries.length : 0,
    averageLostTicket: exits.length ? lostRevenue / exits.length : 0,
  };
}

function buildChurnByReason(
  events: GrowthChurnEvent[],
  reasonsById: Map<string, NamedRecord>,
) {
  const exits = events.filter((event) => event.event_type === "saida");
  const rows = new Map<string, { reason: string; quantity: number; lostRevenue: number }>();

  for (const event of exits) {
    const reason = getEventReasonLabel(event, reasonsById);
    const current = rows.get(reason) ?? {
      reason,
      quantity: 0,
      lostRevenue: 0,
    };

    rows.set(reason, {
      reason,
      quantity: current.quantity + 1,
      lostRevenue: current.lostRevenue + getAmount(event),
    });
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      exitShare: exits.length ? row.quantity / exits.length : 0,
    }))
    .sort((first, second) => second.quantity - first.quantity);
}

function buildGroupedRows<T extends "teacher_id" | "class_id">(
  events: GrowthChurnEvent[],
  recordsById: Map<string, T extends "teacher_id" ? TeacherRecord : NamedRecord>,
  key: T,
) {
  const rows = new Map<
    string,
    {
      name: string;
      entries: number;
      exits: number;
      newRevenue: number;
      lostRevenue: number;
    }
  >();

  for (const event of events) {
    const id = event[key] ?? "unassigned";
    const record = recordsById.get(id);
    const name =
      "fullName" in (record ?? {})
        ? (record as TeacherRecord).fullName
        : (record as NamedRecord | undefined)?.name ?? "Não informado";
    const current = rows.get(id) ?? {
      name,
      entries: 0,
      exits: 0,
      newRevenue: 0,
      lostRevenue: 0,
    };
    const amount = getAmount(event);

    rows.set(id, {
      name,
      entries: current.entries + (event.event_type === "entrada" ? 1 : 0),
      exits: current.exits + (event.event_type === "saida" ? 1 : 0),
      newRevenue:
        current.newRevenue + (event.event_type === "entrada" ? amount : 0),
      lostRevenue:
        current.lostRevenue + (event.event_type === "saida" ? amount : 0),
    });
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      netStudents: row.entries - row.exits,
      netRevenue: row.newRevenue - row.lostRevenue,
    }))
    .sort((first, second) => second.entries + second.exits - (first.entries + first.exits));
}

function sumAmounts(events: GrowthChurnEvent[]) {
  return events.reduce((total, event) => total + getAmount(event), 0);
}

function getAmount(event: GrowthChurnEvent) {
  return event.monthly_amount ?? 0;
}

function QuickFilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          : "inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted"
      }
    >
      {label}
    </Link>
  );
}

function getEventReasonLabel(
  event: GrowthChurnEvent,
  reasonsById: Map<string, NamedRecord>,
) {
  return (
    reasonsById.get(event.reason_id ?? "")?.name ??
    event.reason_notes?.trim() ??
    "Sem motivo informado"
  );
}

function isActiveFilter(value: string | null | undefined) {
  const normalized = value?.trim();
  return Boolean(normalized && normalized !== "Todos");
}

function getDefaultPeriod() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    from: firstDay.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

function getPreviousMonthPeriod() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);

  return {
    from: firstDay.toISOString().slice(0, 10),
    to: lastDay.toISOString().slice(0, 10),
  };
}

function getCurrentYearPeriod() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 0, 1);

  return {
    from: firstDay.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

function getActiveQuickFilter(filters: {
  from: string;
  to: string;
  teacherId: string;
  modalityId: string;
  levelId: string;
  classId: string;
}) {
  if (
    filters.teacherId ||
    filters.modalityId ||
    filters.levelId ||
    filters.classId
  ) {
    return "custom";
  }

  if (matchesPeriod(filters, getDefaultPeriod())) {
    return "thisMonth";
  }

  if (matchesPeriod(filters, getPreviousMonthPeriod())) {
    return "previousMonth";
  }

  if (matchesPeriod(filters, getCurrentYearPeriod())) {
    return "thisYear";
  }

  return "custom";
}

function matchesPeriod(
  filters: { from: string; to: string },
  period: { from: string; to: string },
) {
  return filters.from === period.from && filters.to === period.to;
}

function buildGrowthChurnHref(period: { from: string; to: string }) {
  const params = new URLSearchParams({
    from: period.from,
    to: period.to,
  });

  return `/financeiro/growth-churn?${params.toString()}`;
}

function FilterInput({
  label,
  name,
  type,
  value,
}: {
  label: string;
  name: string;
  type: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
      />
    </label>
  );
}

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function AnalyticTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="hover:bg-muted/50">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${title}-${rowIndex}-${cellIndex}`}
                      className={
                        cellIndex === 0
                          ? "px-4 py-3 font-medium text-foreground"
                          : "px-4 py-3 text-muted-foreground"
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Nenhum dado encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatMoney(value: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatSource(value: string) {
  const labels: Record<string, string> = {
    enrollment_created: "Matrícula criada",
    enrollment_cancelled: "Matrícula cancelada",
    manual: "Manual",
  };

  return labels[value] ?? value;
}
