export const prerender = false;

import type { APIRoute } from 'astro';
import { notionQuery } from '../../../lib/notion';

const ADMIN_KEY             = import.meta.env.ADMIN_KEY ?? '';
const NOTION_WAITLIST_DB_ID = import.meta.env.NOTION_PADEL_WAITLIST_DB_ID ?? '';

function auth(request: Request): boolean {
  return (request.headers.get('x-admin-key') ?? '') === ADMIN_KEY && ADMIN_KEY !== '';
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  if (!NOTION_WAITLIST_DB_ID) {
    return new Response(JSON.stringify({ waitlist: [], error: 'NOTION_PADEL_WAITLIST_DB_ID not set' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  let rows: any[] = [];
  try { rows = await notionQuery(NOTION_WAITLIST_DB_ID); } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502 });
  }

  const waitlist = rows.map((r: any) => {
    const p = r.properties;
    return {
      id:      r.id,
      name:    (p['Name']?.title ?? []).map((t: any) => t.plain_text).join(''),
      email:   p['Email']?.email ?? '',
      addedAt: p['Added At']?.date?.start ?? '',
    };
  });

  if (url.searchParams.get('format') === 'csv') {
    const headers = ['Name', 'Email', 'Added At'];
    const csvRows = waitlist.map(w => [w.name, w.email, w.addedAt].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    return new Response(csv, {
      status: 200,
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="padel-waitlist.csv"' },
    });
  }

  return new Response(JSON.stringify({ waitlist, total: waitlist.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
