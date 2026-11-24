export const prerender = false;
import type { APIRoute } from 'astro';
import { notionPatch, selectProp } from '../../../lib/notion';

const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? '';

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

const PAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{32}$/i;

export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  let body: any;
  try { body = await request.json(); } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { pageId } = body;
  if (!pageId || !PAGE_ID_RE.test(pageId)) {
    return new Response('Missing or invalid pageId', { status: 400 });
  }

  try {
    await notionPatch(pageId, { Status: selectProp('Call Booked') });
    console.log(`[mark-booked] Set Call Booked for ${pageId}`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[mark-booked] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
