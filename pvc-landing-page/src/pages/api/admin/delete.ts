export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const ADMIN_KEY    = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

export const DELETE: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  let pageId: string;
  try {
    const body = await request.json();
    pageId = body.pageId;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const PAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{32}$/i;
  if (!pageId || !PAGE_ID_RE.test(pageId)) return new Response('Invalid pageId', { status: 400 });

  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ archived: true }),
  });

  if (!res.ok) return new Response(await res.text(), { status: res.status });
  return new Response('OK', { status: 200 });
};
