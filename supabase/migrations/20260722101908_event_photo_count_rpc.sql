-- Atomic photo_count/cover_url bump, called by guests (anonymous) and
-- organizers alike right after a photo/video upload or delete, avoiding a
-- read-modify-write race when multiple guests upload concurrently.
create or replace function public.bump_event_photo_count(
  p_event_id text,
  p_delta int,
  p_cover_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set photo_count = greatest(0, photo_count + p_delta),
      cover_url = case when p_cover_url is not null then p_cover_url else cover_url end
  where id = p_event_id;
end;
$$;

revoke all on function public.bump_event_photo_count(text, int, text) from public;
grant execute on function public.bump_event_photo_count(text, int, text) to authenticated;
