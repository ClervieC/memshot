-- Daily cron trigger for the archive-expired-events Edge Function.
-- The bearer key used to call the function ('archive_function_key') is
-- inserted into Supabase Vault out-of-band (not via a committed migration),
-- so the service_role key never ends up in the git history.

select vault.create_secret(
  'https://mwjhxlggggcgwgxedaps.supabase.co/functions/v1/archive-expired-events',
  'archive_function_url',
  'URL of the archive-expired-events Edge Function'
);

select cron.schedule(
  'archive-expired-events-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'archive_function_url'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'archive_function_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
