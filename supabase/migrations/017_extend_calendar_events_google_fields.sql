alter table public.calendar_events
  add column if not exists google_calendar_event_id text,
  add column if not exists google_calendar_id text,
  add column if not exists sync_source text default 'portal';

create index if not exists calendar_events_google_calendar_event_id_idx
  on public.calendar_events (google_calendar_event_id);
