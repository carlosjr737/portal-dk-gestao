import {
  createCalendarEvent,
  changeGoogleCalendar,
  deleteCalendarEvent,
  getCalendarFormOptions,
  getGoogleCalendarStatus,
  listCalendarEvents,
  syncGoogleCalendarMonth,
  updateCalendarEvent,
  type CalendarFilters,
} from "@/features/calendar/actions";
import { CalendarView } from "@/features/calendar/calendar-view";
import { calendarEventTypes } from "@/features/calendar/schemas";
import type { CalendarEventType } from "@/features/calendar/types";
import {
  getAuthenticatedUser,
  getProfileByUserId,
} from "@/features/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CalendarioPageProps = {
  searchParams?: Promise<{
    month?: string;
    view?: string;
    event_type?: string;
    affects_classes?: string;
  }>;
};

export default async function CalendarioPage({
  searchParams,
}: CalendarioPageProps) {
  const params = await searchParams;
  const filters = normalizeFilters(params);
  const view = params?.view === "list" ? "list" : "month";
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  const canManage = profile?.role === "admin" || profile?.role === "equipe";
  const canDelete = profile?.role === "admin";
  const [events, options, googleCalendarStatus] = await Promise.all([
    listCalendarEvents(filters),
    getCalendarFormOptions(),
    getGoogleCalendarStatus(),
  ]);

  return (
    <CalendarView
      events={events}
      options={options}
      month={filters.month}
      view={view}
      eventType={filters.eventType}
      affectsClasses={filters.affectsClasses}
      canManage={canManage}
      canDelete={canDelete}
      createAction={createCalendarEvent}
      updateAction={updateCalendarEvent}
      deleteAction={deleteCalendarEvent}
      googleCalendarStatus={googleCalendarStatus}
      changeGoogleCalendarAction={changeGoogleCalendar}
      syncGoogleCalendarAction={syncGoogleCalendarMonth}
    />
  );
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
