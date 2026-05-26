import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/features/calendar/actions";
import { CalendarEventForm } from "@/features/calendar/calendar-event-form";
import { DeleteCalendarEventButton } from "@/features/calendar/delete-calendar-event-button";
import {
  calendarEventTypes,
  type CalendarEventFormData,
} from "@/features/calendar/schemas";
import type {
  CalendarEvent,
  CalendarEventFormOptions,
  CalendarEventType,
  CalendarSelectOption,
} from "@/features/calendar/types";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CalendarioPageProps = {
  searchParams?: Promise<{
    month?: string;
    event_type?: string;
    affects_classes?: string;
  }>;
};

const eventTypeLabels = new Map(
  calendarEventTypes.map((eventType) => [eventType.value, eventType.label]),
);

export default async function CalendarioPage({
  searchParams,
}: CalendarioPageProps) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  const canManage = profile?.role === "admin" || profile?.role === "equipe";
  const [events, options] = await Promise.all([
    listCalendarEvents(filters),
    getCalendarFormOptions(),
  ]);
  const stats = getStats(events);
  const groupedEvents = groupEventsByDate(events);

  return (
    <div>
      <PageHeader
        title="Calendário"
        description="Feriados, recessos e eventos operacionais do DK Studio."
      />

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <MetricCard label="Eventos do mês" value={String(events.length)} />
        <MetricCard
          label="Feriados/Recessos"
          value={String(stats.holidaysAndBreaks)}
        />
        <MetricCard
          label="Aulas suspensas"
          value={String(stats.suspendedClasses)}
        />
        <MetricCard label="Próximo evento" value={stats.nextEvent} />
      </section>

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <form className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Mês/Ano</span>
            <input
              type="month"
              name="month"
              defaultValue={filters.month}
              className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Tipo de evento
            </span>
            <select
              name="event_type"
              defaultValue={filters.eventType ?? ""}
              className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
            >
              <option value="">Todos</option>
              {calendarEventTypes.map((eventType) => (
                <option key={eventType.value} value={eventType.value}>
                  {eventType.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Afeta aulas
            </span>
            <select
              name="affects_classes"
              defaultValue={filters.affectsClasses}
              className="mt-1 h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
            >
              <option value="all">Todos</option>
              <option value="yes">Sim</option>
              <option value="no">Não</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Filtrar
            </button>
            <Link
              href="/calendario"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Limpar
            </Link>
          </div>
        </form>
      </section>

      {canManage ? (
        <section className="mt-6 rounded-md border border-border bg-white p-5">
          <details>
            <summary className="cursor-pointer text-base font-semibold text-foreground marker:text-primary">
              Novo evento
            </summary>
            <CalendarEventForm
              action={createCalendarEvent}
              options={options}
              submitLabel="Cadastrar evento"
            />
          </details>
        </section>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Eventos cadastrados
          </h2>
        </div>

        {groupedEvents.length > 0 ? (
          <div className="divide-y divide-border">
            {groupedEvents.map(([date, dateEvents]) => (
              <div key={date} className="px-5 py-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {formatDate(date)}
                </h3>
                <div className="mt-3 space-y-3">
                  {dateEvents.map((event) => {
                    const updateAction = updateCalendarEvent.bind(null, event.id);

                    return (
                      <details
                        key={event.id}
                        className="rounded-md border border-border bg-muted/30 p-4"
                      >
                        <summary className="grid cursor-pointer gap-3 marker:hidden md:grid-cols-[1fr_auto] md:items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-foreground">
                                {getEventTypeLabel(event.event_type)}
                              </span>
                              {event.affects_classes ? (
                                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                                  {event.affects_all_classes
                                    ? "Afeta todas as aulas"
                                    : "Afeta aulas"}
                                </span>
                              ) : (
                                <span className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-muted-foreground">
                                  Informativo
                                </span>
                              )}
                            </div>
                            <p className="mt-2 font-medium text-foreground">
                              {event.title}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatEventPeriod(event)}
                            </p>
                            {event.description ? (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {event.description}
                              </p>
                            ) : null}
                          </div>
                          {canManage ? (
                            <div className="flex gap-3">
                              <span className="text-sm font-medium text-primary">
                                Editar
                              </span>
                              <DeleteCalendarEventButton
                                action={deleteCalendarEvent}
                                eventId={event.id}
                              />
                            </div>
                          ) : null}
                        </summary>
                        {canManage ? (
                          <div className="mt-4 border-t border-border pt-4">
                            <CalendarEventForm
                              action={updateAction}
                              options={options}
                              defaultValues={eventToFormValues(event)}
                              submitLabel="Salvar alterações"
                              compact
                            />
                          </div>
                        ) : null}
                      </details>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum evento cadastrado para os filtros selecionados.
          </div>
        )}
      </section>
    </div>
  );
}

type CalendarFilters = {
  month: string;
  eventType: CalendarEventType | null;
  affectsClasses: "all" | "yes" | "no";
};

async function listCalendarEvents(filters: CalendarFilters) {
  const supabase = createAdminClient();
  const { startDate, endDate } = getMonthRange(filters.month);
  let query = supabase
    .from("calendar_events")
    .select(
      "id, title, description, event_type, start_date, end_date, start_time, end_time, all_day, affects_classes, affects_all_classes, class_id, teacher_id, modality_id, level_id, created_by, created_at, updated_at",
    )
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (filters.eventType) {
    query = query.eq("event_type", filters.eventType);
  }

  if (filters.affectsClasses === "yes") {
    query = query.eq("affects_classes", true);
  }

  if (filters.affectsClasses === "no") {
    query = query.eq("affects_classes", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Calendar events load error:", error);
    return [];
  }

  return (data ?? []) as CalendarEvent[];
}

async function getCalendarFormOptions(): Promise<CalendarEventFormOptions> {
  const supabase = createAdminClient();
  const [
    { data: classes, error: classesError },
    { data: teachers, error: teachersError },
    { data: modalities, error: modalitiesError },
    { data: levels, error: levelsError },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name")
      .neq("status", "inactive")
      .order("name", { ascending: true }),
    supabase
      .from("staff_members")
      .select("id, full_name, artistic_name")
      .eq("role", "professor")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    supabase
      .from("modalities")
      .select("id, name")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("levels")
      .select("id, name")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const firstError = classesError ?? teachersError ?? modalitiesError ?? levelsError;

  if (firstError) {
    console.error("Calendar form options load error:", firstError);
  }

  return {
    classes: ((classes ?? []) as CalendarSelectOption[]).map((item) => ({
      id: item.id,
      name: item.name,
    })),
    teachers: ((teachers ?? []) as Array<{
      id: string;
      full_name: string | null;
      artistic_name: string | null;
    }>).map((teacher) => ({
      id: teacher.id,
      name: teacher.artistic_name || teacher.full_name || "Professor sem nome",
    })),
    modalities: ((modalities ?? []) as CalendarSelectOption[]).map((item) => ({
      id: item.id,
      name: item.name,
    })),
    levels: ((levels ?? []) as CalendarSelectOption[]).map((item) => ({
      id: item.id,
      name: item.name,
    })),
  };
}

function normalizeFilters(
  params: Awaited<CalendarioPageProps["searchParams"]>,
): CalendarFilters {
  const eventType = calendarEventTypes.some(
    (option) => option.value === params?.event_type,
  )
    ? (params?.event_type as CalendarEventType)
    : null;
  const affectsClasses =
    params?.affects_classes === "yes" || params?.affects_classes === "no"
      ? params.affects_classes
      : "all";

  return {
    month: normalizeMonth(params?.month),
    eventType,
    affectsClasses,
  };
}

function normalizeMonth(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  return {
    startDate: formatDateValue(start),
    endDate: formatDateValue(end),
  };
}

function getStats(events: CalendarEvent[]) {
  const nextEvent = events.find((event) => event.end_date >= formatDateValue(new Date()));

  return {
    holidaysAndBreaks: events.filter((event) =>
      ["feriado", "recesso"].includes(event.event_type),
    ).length,
    suspendedClasses: events.filter((event) => event.affects_classes).length,
    nextEvent: nextEvent ? nextEvent.title : "-",
  };
}

function groupEventsByDate(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const current = groups.get(event.start_date) ?? [];
    groups.set(event.start_date, [...current, event]);
  }

  return Array.from(groups.entries());
}

function eventToFormValues(event: CalendarEvent): Partial<CalendarEventFormData> {
  return {
    title: event.title,
    description: event.description,
    event_type: event.event_type,
    start_date: event.start_date,
    end_date: event.end_date,
    all_day: event.all_day,
    start_time: event.start_time ? event.start_time.slice(0, 5) : null,
    end_time: event.end_time ? event.end_time.slice(0, 5) : null,
    affects_classes: event.affects_classes,
    affects_all_classes: event.affects_all_classes,
    class_id: event.class_id,
    teacher_id: event.teacher_id,
    modality_id: event.modality_id,
    level_id: event.level_id,
  };
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatEventPeriod(event: CalendarEvent) {
  const dates =
    event.start_date === event.end_date
      ? formatDate(event.start_date)
      : `${formatDate(event.start_date)} até ${formatDate(event.end_date)}`;

  if (event.all_day) {
    return `${dates} | Dia inteiro`;
  }

  const startTime = event.start_time ? event.start_time.slice(0, 5) : "--:--";
  const endTime = event.end_time ? event.end_time.slice(0, 5) : "--:--";

  return `${dates} | ${startTime}-${endTime}`;
}

function getEventTypeLabel(eventType: CalendarEventType) {
  return eventTypeLabels.get(eventType) ?? eventType;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
