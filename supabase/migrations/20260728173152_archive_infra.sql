-- Infra for automatic archival of events older than 30 days:
-- private bucket to hold the generated zips, and the extensions needed
-- to call the archive-expired-events Edge Function on a daily schedule.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- private: only the service role (used by the Edge Function) can read/write it,
-- so no RLS policies are needed here.
insert into storage.buckets (id, name, public)
values ('memshot-archives', 'memshot-archives', false)
on conflict (id) do nothing;
