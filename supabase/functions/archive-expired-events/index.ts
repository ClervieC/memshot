// Runs daily via pg_cron (see the archive_cron migration). For every event
// older than 30 days: zips its media, emails the organizer a download link,
// then deletes the event. The event is only deleted once the email has been
// sent successfully, so a Resend outage never causes photo loss — the event
// just gets retried on the next run.
import { createClient } from 'npm:@supabase/supabase-js@2';
import JSZip from 'npm:jszip@3';

const MEDIA_BUCKET = 'memshot-media';
const ARCHIVE_BUCKET = 'memshot-archives';
const RETENTION_DAYS = 30;
const SIGNED_URL_TTL_SECONDS = 30 * 24 * 60 * 60;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function extFromUrl(url: string, type: string): string {
  const clean = url.split('?')[0];
  const last = clean.split('/').pop() || '';
  const dot = last.lastIndexOf('.');
  if (dot > -1) return last.slice(dot + 1);
  return type === 'video' ? 'mp4' : 'jpg';
}

function mediaStoragePath(url: string): string | null {
  const marker = `/object/public/${MEDIA_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

async function sendArchiveEmail(toEmail: string, eventName: string, downloadUrl: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('ARCHIVE_FROM_EMAIL');
  if (!apiKey || !from) {
    console.error('RESEND_API_KEY or ARCHIVE_FROM_EMAIL not configured');
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: toEmail,
      subject: `Memshot – archive de "${eventName}"`,
      html: `
        <p>Bonjour,</p>
        <p>L'événement <strong>${eventName}</strong> a plus d'un mois. Toutes ses photos et vidéos
        ont été rassemblées dans une archive ZIP, disponible pendant 30 jours :</p>
        <p><a href="${downloadUrl}">${downloadUrl}</a></p>
        <p>L'événement a été supprimé de Memshot. Passé ce délai, l'archive ne sera plus disponible.</p>
      `,
    }),
  });
  if (!res.ok) {
    console.error('Resend send failed:', res.status, await res.text());
    return false;
  }
  return true;
}

async function archiveEvent(event: { id: string; name: string; organizer_id: string }) {
  const { data: photos, error: photosErr } = await supabase
    .from('photos').select('id, url, type, uploader_name').eq('event_id', event.id);
  if (photosErr) return { id: event.id, status: 'error', error: photosErr.message };

  if (!photos || photos.length === 0) {
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    return error ? { id: event.id, status: 'error', error: error.message } : { id: event.id, status: 'deleted-empty' };
  }

  const zip = new JSZip();
  let included = 0;
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    try {
      const resp = await fetch(p.url);
      if (!resp.ok) continue;
      const buf = new Uint8Array(await resp.arrayBuffer());
      const prefix = (p.uploader_name || 'photo').replace(/[^a-zA-Z0-9]/g, '_');
      zip.file(`${prefix}_${String(i + 1).padStart(3, '0')}.${extFromUrl(p.url, p.type)}`, buf);
      included++;
    } catch {
      // dead/unreachable source file: skip it, don't fail the whole archive
    }
  }

  if (included === 0) {
    return { id: event.id, status: 'skipped-no-reachable-media' };
  }

  const zipBytes = await zip.generateAsync({ type: 'uint8array' });
  const zipPath = `${event.id}.zip`;
  const { error: upErr } = await supabase.storage.from(ARCHIVE_BUCKET)
    .upload(zipPath, zipBytes, { contentType: 'application/zip', upsert: true });
  if (upErr) return { id: event.id, status: 'error', error: upErr.message };

  const { data: signed, error: signErr } = await supabase.storage.from(ARCHIVE_BUCKET)
    .createSignedUrl(zipPath, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed) return { id: event.id, status: 'error', error: signErr?.message ?? 'no signed url' };

  const toEmail = Deno.env.get('ARCHIVE_TO_EMAIL');
  if (!toEmail) {
    return { id: event.id, status: 'error', error: 'ARCHIVE_TO_EMAIL not configured' };
  }

  const emailed = await sendArchiveEmail(toEmail, event.name, signed.signedUrl);
  if (!emailed) {
    return { id: event.id, status: 'email-failed-not-deleted' };
  }

  const mediaPaths = photos.map(p => mediaStoragePath(p.url)).filter((p): p is string => !!p);
  if (mediaPaths.length > 0) {
    await supabase.storage.from(MEDIA_BUCKET).remove(mediaPaths);
  }

  const { error: delErr } = await supabase.from('events').delete().eq('id', event.id);
  if (delErr) return { id: event.id, status: 'error', error: delErr.message };

  return { id: event.id, status: 'archived-and-deleted', photos: included, zipPath };
}

Deno.serve(async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error } = await supabase
    .from('events').select('id, name, organizer_id').lt('created_at', cutoff).eq('archive_exempt', false);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = [];
  for (const event of events ?? []) {
    results.push(await archiveEvent(event));
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
