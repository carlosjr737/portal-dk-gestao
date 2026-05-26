"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type {
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
} from "@/features/calendar/types";
import { cn } from "@/lib/utils";

type CalendarViewProps = {
  events: CalendarEvent[];
  options: CalendarEventFormOptions;
  month: string;
  view: "month" | "list";
  eventType: CalendarEventType | null;
  affectsClasses: "all" | "yes" | "no";
  canManage: boolean;
  canDelete: boolean;
  createAction: typeof createCalendarEvent;
  updateAction: typeof updateCalendarEvent;
  deleteAction: typeof deleteCalendarEvent;
};

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const eventTypeLabels = new Map(
  calendarEventTypes.map((eventType) => [eventType.value, eventType.label]),
);

const eventTypeStyles: Record<CalendarEventType, string> = {
  feriado: "border-red-200 bg-red-50 text-red-700",
  recesso: "border-amber-200 bg-amber-50 text-amber-800",
  evento: "border-blue-200 bg-blue-50 text-blue-700",
  ensaio: "border-violet-200 bg-violet-50 text-violet-700",
  espetaculo: "border-emerald-200 bg-emerald-50 text-emerald-700",
  aula_suspensa: "border-rose-200 bg-rose-50 text-rose-700",
  reposicao: "border-cyan-200 bg-cyan-50 text-cyan-700",
  outro: "border-slate-200 bg-slate-50 text-slate-700",
};

export function CalendarView({
  events,
  options,
  month,
  view,
  eventType,
  affectsClasses,
  canManage,
  canDelete,
  createAction,
  updateAction,
  deleteAction,
}: CalendarViewProps) {
  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "detail"; event: CalendarEvent }
    | { mode: "edit"; event: CalendarEvent }
    | null
  >(null);
  const monthGrid = useMemo(() => buildMonthGrid(month, events), [month, events]);
  const groupedEvents = useMemo(() => groupEventsByDate(events), [events]);
  const stats = getStats(events);

  return (
    <div>
      <section className="border-b border-border pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              Portal DK Gestão
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
              Calendário DK
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Feriados, eventos, ensaios, recessos e aulas suspensas.
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={() => setModal({ mode: "create" })}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Novo evento
            </button>
          ) : null}
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1.3fr]">
        <MetricCard label="Eventos do mês" value={String(events.length)} />
        <MetricCard
          label="Feriados/Recessos"
          value={String(stats.holidaysAndBreaks)}
        />
        <MetricCard
          label="Aulas suspensas"
          value={String(stats.suspendedClasses)}
        />
        <div className="rounded-md border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Google Agenda
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                Não conectado
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Integração com Google Agenda será configurada na próxima etapa.
              </p>
            </div>
            <button
              type="button"
              disabled
              className="h-9 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground opacity-70"
            >
              Conectar Google Agenda
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-md border border-border bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildHref({
                month: getCurrentMonthValue(),
                view,
                eventType,
                affectsClasses,
              })}
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Hoje
            </Link>
            <Link
              href={buildHref({
                month: shiftMonth(month, -1),
                view,
                eventType,
                affectsClasses,
              })}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-lg font-medium text-foreground transition hover:bg-muted"
              aria-label="Mês anterior"
            >
              ‹
            </Link>
            <p className="min-w-44 text-center text-base font-semibold text-foreground">
              {formatMonthLabel(month)}
            </p>
            <Link
              href={buildHref({
                month: shiftMonth(month, 1),
                view,
                eventType,
                affectsClasses,
              })}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-lg font-medium text-foreground transition hover:bg-muted"
              aria-label="Próximo mês"
            >
              ›
            </Link>
          </div>

          <form className="grid gap-2 md:grid-cols-[140px_170px_170px_auto]">
            <input type="hidden" name="view" value={view} />
            <label>
              <span className="sr-only">Mês/Ano</span>
              <input
                type="month"
                name="month"
                defaultValue={month}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
              />
            </label>
            <label>
              <span className="sr-only">Tipo de evento</span>
              <select
                name="event_type"
                defaultValue={eventType ?? ""}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
              >
                <option value="">Todos os tipos</option>
                {calendarEventTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Afeta aulas</span>
              <select
                name="affects_classes"
                defaultValue={affectsClasses}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition focus:border-primary"
              >
                <option value="all">Afeta aulas: todos</option>
                <option value="yes">Afeta aulas: sim</option>
                <option value="no">Afeta aulas: não</option>
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Filtrar
            </button>
          </form>
        </div>

        <div className="mt-4 flex w-full rounded-md border border-border bg-muted p-1 sm:w-fit">
          <ViewLink
            label="Mês"
            active={view === "month"}
            href={buildHref({ month, view: "month", eventType, affectsClasses })}
          />
          <span className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground opacity-60">
            Semana
          </span>
          <ViewLink
            label="Lista"
            active={view === "list"}
            href={buildHref({ month, view: "list", eventType, affectsClasses })}
          />
        </div>
      </section>

      <section className={cn("mt-6", view === "list" ? "hidden" : "block")}>
        <div className="hidden overflow-hidden rounded-md border border-border bg-white md:block">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {weekDays.map((day) => (
              <div
                key={day}
                className="border-r border-border px-3 py-2 text-xs font-semibold uppercase text-muted-foreground last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid.map((day) => (
              <button
                key={day.isoDate}
                type="button"
                onClick={() => {
                  if (day.events[0]) {
                    setModal({ mode: "detail", event: day.events[0] });
                  }
                }}
                className={cn(
                  "min-h-32 border-r border-t border-border p-2 text-left align-top transition hover:bg-muted/40",
                  !day.inCurrentMonth && "bg-muted/20 text-muted-foreground",
                  day.isToday && "bg-primary/5",
                  (day.index + 1) % 7 === 0 && "border-r-0",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                    day.isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground",
                  )}
                >
                  {day.dayNumber}
                </span>
                <div className="mt-2 space-y-1">
                  {day.events.slice(0, 3).map((event) => (
                    <span
                      key={`${day.isoDate}-${event.id}`}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        setModal({ mode: "detail", event });
                      }}
                      className={cn(
                        "block truncate rounded-md border px-2 py-1 text-xs font-medium",
                        eventTypeStyles[event.event_type],
                      )}
                    >
                      {formatEventChip(event)}
                    </span>
                  ))}
                  {day.events.length > 3 ? (
                    <span className="block px-2 text-xs font-medium text-muted-foreground">
                      + {day.events.length - 3} eventos
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="md:hidden">
          <EventList
            groupedEvents={groupedEvents}
            onOpen={(event) => setModal({ mode: "detail", event })}
          />
        </div>
      </section>

      <section className={cn("mt-6", view === "list" ? "block" : "hidden")}>
        <EventList
          groupedEvents={groupedEvents}
          onOpen={(event) => setModal({ mode: "detail", event })}
        />
      </section>

      {modal ? (
        <Modal
          title={
            modal.mode === "create"
              ? "Novo evento"
              : modal.mode === "edit"
                ? "Editar evento"
                : "Detalhes do evento"
          }
          onClose={() => setModal(null)}
        >
          {modal.mode === "create" ? (
            <CalendarEventForm
              action={createAction}
              options={options}
              submitLabel="Cadastrar evento"
            />
          ) : null}

          {modal.mode === "detail" ? (
            <EventDetail
              event={modal.event}
              canManage={canManage}
              canDelete={canDelete}
              deleteAction={deleteAction}
              onEdit={() => setModal({ mode: "edit", event: modal.event })}
            />
          ) : null}

          {modal.mode === "edit" ? (
            <CalendarEventForm
              action={updateAction.bind(null, modal.event.id)}
              options={options}
              defaultValues={eventToFormValues(modal.event)}
              submitLabel="Salvar alterações"
            />
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function EventList({
  groupedEvents,
  onOpen,
}: {
  groupedEvents: Array<[string, CalendarEvent[]]>;
  onOpen: (event: CalendarEvent) => void;
}) {
  if (groupedEvents.length === 0) {
    return (
      <div className="rounded-md border border-border bg-white px-5 py-10 text-center text-sm text-muted-foreground">
        Nenhum evento cadastrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-white">
      <div className="divide-y divide-border">
        {groupedEvents.map(([date, dateEvents]) => (
          <div key={date} className="px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">
              {formatDate(date)}
            </h2>
            <div className="mt-3 space-y-2">
              {dateEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onOpen(event)}
                  className="grid w-full gap-3 rounded-md border border-border bg-muted/20 p-3 text-left transition hover:bg-muted/50 md:grid-cols-[120px_1fr_auto]"
                >
                  <span className="text-sm font-medium text-muted-foreground">
                    {event.all_day
                      ? "Dia inteiro"
                      : `${formatTime(event.start_time)}-${formatTime(event.end_time)}`}
                  </span>
                  <span>
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-2 py-1 text-xs font-medium",
                        eventTypeStyles[event.event_type],
                      )}
                    >
                      {getEventTypeLabel(event.event_type)}
                    </span>
                    <span className="mt-2 block font-medium text-foreground">
                      {event.title}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {event.affects_classes
                      ? event.affects_all_classes
                        ? "Afeta todas as aulas"
                        : "Afeta aulas"
                      : "Informativo"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventDetail({
  event,
  canManage,
  canDelete,
  deleteAction,
  onEdit,
}: {
  event: CalendarEvent;
  canManage: boolean;
  canDelete: boolean;
  deleteAction: typeof deleteCalendarEvent;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-medium",
            eventTypeStyles[event.event_type],
          )}
        >
          {getEventTypeLabel(event.event_type)}
        </span>
        <span className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium text-muted-foreground">
          {event.affects_classes ? "Afeta aulas" : "Informativo"}
        </span>
      </div>
      <div>
        <h3 className="text-xl font-semibold text-foreground">{event.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatEventPeriod(event)}
        </p>
      </div>
      {event.description ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {event.description}
        </p>
      ) : null}
      {canManage ? (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Editar
          </button>
          {canDelete ? (
            <DeleteCalendarEventButton
              action={deleteAction}
              eventId={event.id}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="w-full max-w-3xl rounded-md bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-xl text-muted-foreground transition hover:bg-muted"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ViewLink({
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
      className={cn(
        "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition",
        active
          ? "bg-white text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function buildMonthGrid(month: string, events: CalendarEvent[]) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const gridStart = new Date(year, monthIndex, 1 - firstDay.getDay());
  const gridEnd = new Date(year, monthIndex + 1, 6 - lastDay.getDay());
  const days = [];
  const today = formatDateValue(new Date());

  for (
    let date = new Date(gridStart), index = 0;
    date <= gridEnd;
    date.setDate(date.getDate() + 1), index += 1
  ) {
    const isoDate = formatDateValue(date);

    days.push({
      isoDate,
      index,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === monthIndex,
      isToday: isoDate === today,
      events: events.filter(
        (event) => event.start_date <= isoDate && event.end_date >= isoDate,
      ),
    });
  }

  return days;
}

function groupEventsByDate(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const current = groups.get(event.start_date) ?? [];
    groups.set(event.start_date, [...current, event]);
  }

  return Array.from(groups.entries());
}

function getStats(events: CalendarEvent[]) {
  return {
    holidaysAndBreaks: events.filter((event) =>
      ["feriado", "recesso"].includes(event.event_type),
    ).length,
    suspendedClasses: events.filter((event) => event.affects_classes).length,
  };
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

function buildHref({
  month,
  view,
  eventType,
  affectsClasses,
}: {
  month: string;
  view: "month" | "list";
  eventType: CalendarEventType | null;
  affectsClasses: "all" | "yes" | "no";
}) {
  const params = new URLSearchParams({ month, view });

  if (eventType) {
    params.set("event_type", eventType);
  }

  if (affectsClasses !== "all") {
    params.set("affects_classes", affectsClasses);
  }

  return `/calendario?${params.toString()}`;
}

function shiftMonth(month: string, amount: number) {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1 + amount, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  const date = new Date(Number(year), Number(monthNumber) - 1, 1);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatEventChip(event: CalendarEvent) {
  const time = event.all_day ? "" : `${formatTime(event.start_time)} `;
  return `${time}${event.title}`;
}

function formatEventPeriod(event: CalendarEvent) {
  const dates =
    event.start_date === event.end_date
      ? formatDate(event.start_date)
      : `${formatDate(event.start_date)} até ${formatDate(event.end_date)}`;

  if (event.all_day) {
    return `${dates} | Dia inteiro`;
  }

  return `${dates} | ${formatTime(event.start_time)}-${formatTime(event.end_time)}`;
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "--:--";
}

function getEventTypeLabel(eventType: CalendarEventType) {
  return eventTypeLabels.get(eventType) ?? eventType;
}
