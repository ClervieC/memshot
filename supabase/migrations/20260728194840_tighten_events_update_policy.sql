-- The original "any authenticated user can update an event" policy was kept
-- broad to match Firebase's original rules, but the only guest-facing write
-- (photo_count/cover_url bump on upload) already goes through the
-- security-definer RPC bump_event_photo_count, which bypasses RLS entirely.
-- Every remaining direct .update() call (setEventClosed, setCoverUrl) is only
-- ever triggered from organizer-only UI, so this can be scoped down safely.
drop policy "events_update_authenticated" on public.events;

create policy "events_update_organizer" on public.events
  for update using (auth.uid() = organizer_id);
