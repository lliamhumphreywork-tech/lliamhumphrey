export const prerender = false;
import type { APIRoute } from 'astro';
import { put, list, del } from '@vercel/blob';

const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? '';

function authed(req: Request): boolean {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

export const GET: APIRoute = async ({ url, request }) => {
  if (!authed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const { blobs } = await list({ prefix: 'recordings/meta/' });
  const fetches = blobs.map(b => fetch(b.url).then(r => r.json()));
  const recordings = (await Promise.all(fetches)).sort(
    (a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  return new Response(JSON.stringify({ ok: true, recordings }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (!authed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const formData = await request.formData();

  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const date = (formData.get('date') as string)?.trim();

  if (!file || !title || !date) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }

  const id = `rec_${Date.now()}`;
  const ext = file.name.split('.').pop() ?? 'mp4';

  const videoBlob = await put(`recordings/video/${id}.${ext}`, file, {
    access: 'public',
    addRandomSuffix: false,
  });

  const meta = { id, title, description, date, videoUrl: videoBlob.url, uploadedAt: new Date().toISOString() };

  await put(`recordings/meta/${id}.json`, JSON.stringify(meta), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });

  return new Response(JSON.stringify({ ok: true, id, url: videoBlob.url }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  if (!authed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const { id } = await request.json();

  const { blobs } = await list({ prefix: `recordings/meta/${id}` });
  const metaUrl = blobs[0]?.url;
  if (!metaUrl) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  const metaData = await fetch(metaUrl).then(r => r.json());
  await del([metaUrl, metaData.videoUrl]);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
