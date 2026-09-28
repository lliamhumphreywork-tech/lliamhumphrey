export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const PORTAL_ACCESS_DB = import.meta.env.NOTION_PORTAL_ACCESS_DB_ID;
const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? '';

function authed(request: Request): boolean {
  return request.headers.get('x-admin-key') === ADMIN_KEY && ADMIN_KEY !== '';
}

export const GET: APIRoute = async ({ request }) => {
  if (!authed(request)) return new Response('Unauthorized', { status: 401 });
  const res = await fetch(`https://api.notion.com/v1/databases/${PORTAL_ACCESS_DB}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ sorts: [{ timestamp: 'created_time', direction: 'descending' }] }),
  });
  const data = await res.json();
  const rows = (data.results ?? []).map((page: any) => ({
    pageId: page.id,
    email: (page.properties.Email?.title ?? []).map((t: any) => t.plain_text).join(''),
    name: (page.properties.Name?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
    approved: page.properties.Approved?.checkbox ?? false,
    added: page.created_time,
  }));
  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
};

const PAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{32}$/i;

export const POST: APIRoute = async ({ request }) => {
  if (!authed(request)) return new Response('Unauthorized', { status: 401 });
  const { pageId } = await request.json();
  if (!pageId || !PAGE_ID_RE.test(pageId)) return new Response('Invalid pageId', { status: 400 });
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ properties: { Approved: { checkbox: true } } }),
  });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
