export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_MEMBERS_DB_ID = import.meta.env.NOTION_MEMBERS_DB_ID ?? 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';
const ADMIN_KEY = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

function parseMember(page: any) {
  const p = page.properties;
  const getText  = (k: string) => (p[k]?.rich_text ?? []).map((t: any) => t.plain_text).join('');
  const getTitle = (k: string) => (p[k]?.title     ?? []).map((t: any) => t.plain_text).join('');

  return {
    id:     page.id,
    n:      getTitle('Name') || getTitle('Full Name'),
    b:      getText('Business') || getText('Company'),
    r:      p['Revenue']?.select?.name ?? p['Stage']?.select?.name ?? '',
    i:      getText('IG') || getText('Instagram'),
    p:      p['Phone']?.phone_number ?? '',
    e:      p['Email']?.email ?? getText('Email'),
    status: p['Status']?.select?.name ?? p['Membership Status']?.select?.name ?? '',
    tier:   p['Tier']?.select?.name ?? p['Ticket']?.select?.name ?? '',
    notes:  getText('Notes'),
    since:  p['Member Since']?.date?.start ?? p['Date']?.date?.start ?? page.created_time?.slice(0, 10) ?? '',
    url:    page.url,
  };
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const all: any[] = [];
  let cursor: string | undefined;

  do {
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_MEMBERS_DB_ID}/query`, {
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
    all.push(...(data.results ?? []).map(parseMember));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return new Response(JSON.stringify(all), {
    headers: { 'Content-Type': 'application/json' },
  });
};
