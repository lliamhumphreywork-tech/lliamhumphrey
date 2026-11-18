export const prerender = false;

import type { APIRoute } from 'astro';
import { notionQuery } from '../../../lib/notion';
import { PADEL } from '../../../lib/padel-config';

const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? '';

function auth(request: Request): boolean {
  return (request.headers.get('x-admin-key') ?? '') === ADMIN_KEY && ADMIN_KEY !== '';
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  let rows: any[] = [];
  try { rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID); } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502 });
  }

  // Consented only, non-refunded only
  const tags = rows
    .filter((r: any) => r.properties['Consent']?.checkbox && !r.properties['Refunded']?.checkbox)
    .map((r: any) => {
      const p = r.properties;
      const offer = (p['Offer']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
      const askMeAbout = offer.split('\n')[0].trim(); // first line only
      return {
        name:        (p['Name']?.title ?? []).map((t: any) => t.plain_text).join(''),
        business:    (p['Business']?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
        askMeAbout,
      };
    });

  if (url.searchParams.get('format') === 'csv') {
    const headers = ['Name', 'Business', 'Ask Me About'];
    const csvRows = tags.map(t => [t.name, t.business, t.askMeAbout].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    return new Response(csv, {
      status: 200,
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="padel-nametags.csv"' },
    });
  }

  if (url.searchParams.get('format') === 'print') {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Name Tags</title>
<style>
  body{font-family:sans-serif;margin:0;padding:16px;}
  .tags{display:flex;flex-wrap:wrap;gap:12px;}
  .tag{border:2px solid #000;border-radius:8px;padding:12px 16px;width:200px;min-height:80px;page-break-inside:avoid;}
  .name{font-size:1.1rem;font-weight:700;margin-bottom:4px;}
  .business{font-size:0.85rem;color:#444;margin-bottom:6px;}
  .ask{font-size:0.75rem;color:#666;}
  .ask-label{font-weight:600;text-transform:uppercase;font-size:0.65rem;letter-spacing:.05em;}
  @media print{body{padding:0;}.tags{gap:8px;}}
</style></head><body>
<div class="tags">
${tags.map(t => `<div class="tag">
  <div class="name">${esc(t.name)}</div>
  <div class="business">${esc(t.business)}</div>
  ${t.askMeAbout ? `<div class="ask-label">Ask me about</div><div class="ask">${esc(t.askMeAbout)}</div>` : ''}
</div>`).join('\n')}
</div></body></html>`;
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }

  return new Response(JSON.stringify({ tags, total: tags.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
