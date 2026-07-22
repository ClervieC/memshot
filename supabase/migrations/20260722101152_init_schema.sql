-- memshot: events + photos, RLS, realtime, storage
-- ids kept as text (not uuid) because Firestore event/photo ids are already
-- shared publicly via printed QR codes and links; they must be preserved.

create table public.events (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text,
  password text not null,
  password_hash text,
  organizer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  date timestamptz not null,
  photo_count integer not null default 0,
  cover_url text,
  closed boolean not null default false
);

create table public.photos (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references public.events(id) on delete cascade,
  url text not null,
  type text not null default 'photo' check (type in ('photo', 'video')),
  uploaded_at timestamptz not null default now(),
  uploader_name text
);

create index photos_event_id_uploaded_at_idx on public.photos (event_id, uploaded_at desc);
create index events_organizer_id_created_at_idx on public.events (organizer_id, created_at desc);

alter table public.events enable row level security;
alter table public.photos enable row level security;

-- events: readable by anyone (guests need to read event info before/without
-- an authenticated session); only the organizer can create/close/delete;
-- update is open to any authenticated user (incl. anonymous guests) because
-- uploadPhoto/uploadVideo bump photo_count and cover_url from the guest session.
create policy "events_select_public" on public.events
  for select using (true);

create policy "events_insert_organizer" on public.events
  for insert with check (auth.uid() = organizer_id);

create policy "events_update_authenticated" on public.events
  for update using (auth.role() = 'authenticated');

create policy "events_delete_organizer" on public.events
  for delete using (auth.uid() = organizer_id);

-- photos: readable by anyone; insert/delete by any authenticated user
-- (organizer or anonymous guest), matching current app behavior.
create policy "photos_select_public" on public.photos
  for select using (true);

create policy "photos_insert_authenticated" on public.photos
  for insert with check (auth.role() = 'authenticated');

create policy "photos_delete_authenticated" on public.photos
  for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.photos;

-- storage: public bucket for photo/video uploads
insert into storage.buckets (id, name, public)
values ('memshot-media', 'memshot-media', true);

create policy "memshot_media_select_public" on storage.objects
  for select using (bucket_id = 'memshot-media');

create policy "memshot_media_insert_authenticated" on storage.objects
  for insert with check (bucket_id = 'memshot-media' and auth.role() = 'authenticated');

create policy "memshot_media_delete_authenticated" on storage.objects
  for delete using (bucket_id = 'memshot-media' and auth.role() = 'authenticated');
