// Cloudflare Worker — Memshot R2 Upload Proxy
//
// Setup dans le dashboard Cloudflare :
//   1. Créer un Worker et coller ce code
//   2. Settings > Variables > ajouter :
//        UPLOAD_SECRET  = une clé secrète (ex: openssl rand -hex 32)
//        PUBLIC_URL     = l'URL publique de ton bucket (ex: https://pub-xxxx.r2.dev)
//   3. Settings > Bindings > R2 Bucket > nom de variable : BUCKET

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Secret',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }

    const secret = request.headers.get('X-Upload-Secret');
    if (!secret || secret !== env.UPLOAD_SECRET) {
      return json({ error: 'Unauthorized' }, 401, cors);
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return json({ error: 'Invalid form data' }, 400, cors);
    }

    const file = formData.get('file');
    const folder = formData.get('folder') || 'general';

    if (!file || typeof file === 'string') {
      return json({ error: 'No file provided' }, 400, cors);
    }

    const ext = file.name.split('.').pop() || 'bin';
    const key = `memshot/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    return json({ url: `${env.PUBLIC_URL}/${key}` }, 200, cors);
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
