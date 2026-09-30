export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DB_ID = '872bd20eee31468f91bed1cd472e157a';
const ADMIN_KEY    = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

function tier(score: number | null) {
  if (score === null) return 'C';
  if (score >= 5) return 'A';
  if (score >= 3) return 'B';
  return 'C';
}

function parseApplicant(page: any) {
  const p = page.properties;
  const getText  = (prop: string) => (p[prop]?.rich_text ?? []).map((t: any) => t.plain_text).join('');
  const getTitle = (prop: string) => (p[prop]?.title     ?? []).map((t: any) => t.plain_text).join('');

  const notes = getText('Notes');
  const emailMatch  = notes.match(/Email: ([^\n|]+)/);
  const sourceMatch = notes.match(/Source: ([^|]+)/);

  const score = p['Application Score']?.number ?? null;
  return {
    id: page.id,
    n: getTitle('Name'),
    b: getText('Business'),
    r: p['Revenue']?.select?.name ?? '',
    w: getText('Goals'),
    s: score,
    t: tier(score),
    i: getText('IG'),
    p: p['Phone']?.phone_number ?? '',
    e: emailMatch ? emailMatch[1].trim() : (p['Email']?.email ?? ''),
    status: p['Status']?.select?.name ?? '',
    type: (p['Type']?.multi_select ?? []).map((s: any) => s.name),
    src: sourceMatch ? sourceMatch[1].trim() : '',
    notes: notes,
    url: page.url,
  };
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const all: any[] = [];
  let cursor: string | undefined;

  do {
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify(data), { status: res.status });
    all.push(...(data.results ?? []).map(parseApplicant));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return new Response(JSON.stringify(all), {
    headers: { 'Content-Type': 'application/json' },
  });
};
