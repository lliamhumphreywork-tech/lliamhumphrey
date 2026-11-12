export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN  = import.meta.env.NOTION_TOKEN ?? '';
const ADMIN_KEY     = import.meta.env.ADMIN_KEY ?? '';
const INTROS_DB_ID  = '1b79aa5765af471582f672445e05173b';

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  let body: { a: string; b: string; reason?: string; draft?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { a, b, reason = '', draft = '' } = body;
  if (!a || !b) return new Response(JSON.stringify({ error: 'Missing a or b' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: INTROS_DB_ID },
      properties: {
        Name:       { title:     [{ text: { content: `${a} ↔ ${b}` } }] },
        'Member A': { rich_text: [{ text: { content: a } }] },
        'Member B': { rich_text: [{ text: { content: b } }] },
        Draft:      { rich_text: [{ text: { content: draft.slice(0, 2000) } }] },
        'Date Sent':{ date: { start: new Date().toISOString().split('T')[0] } },
        Status:     { select: { name: 'Sent' } },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[mark-intro-sent] Notion error:', err.slice(0, 300));
    return new Response(JSON.stringify({ error: 'Notion write failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
