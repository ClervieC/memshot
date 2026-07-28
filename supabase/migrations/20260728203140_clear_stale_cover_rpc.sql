-- Any viewer (guest or organizer) can trigger the dead-photo auto-cleanup in
-- gallery.component.ts's onPhotoLoadError, which needs to reassign cover_url
-- if the broken photo was the cover. The events UPDATE policy is organizer-only
-- (see tighten_events_update_policy migration), so guests need a
-- security-definer RPC for this one narrow case, same pattern as
-- bump_event_photo_count. The stale_url guard avoids clobbering a cover that
-- has already changed (e.g. a new photo was uploaded) since the client last
-- read it.
create or replace function public.clear_stale_cover(p_event_id text, p_stale_url text, p_new_url text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.events
  set cover_url = nullif(p_new_url, '')
  where id = p_event_id and cover_url = p_stale_url;
$$;

revoke all on function public.clear_stale_cover(text, text, text) from public;
grant execute on function public.clear_stale_cover(text, text, text) to authenticated;
