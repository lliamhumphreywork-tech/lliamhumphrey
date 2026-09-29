export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const SUPPLY_DB    = '770e8282-037c-4405-bdea-1eb41023cd42';
const DEMAND_DB    = 'fe06d735-b2cb-414e-b078-8acac2f7e92f';
const ADMIN_KEY    = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function queryDB(dbId: string, kind: string) {
  const results: any[] = [];
  let cursor: string | undefined;

  do {
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) break;
    const data = await res.json();
    for (const page of (data.results ?? [])) {
      const p = page.properties;
      const getText  = (k: string) => (p[k]?.rich_text ?? []).map((t: any) => t.plain_text).join('');
      const getTitle = (k: string) => (p[k]?.title     ?? []).map((t: any) => t.plain_text).join('');
      const getMulti = (k: string) => (p[k]?.multi_select ?? []).map((s: any) => s.name);

      results.push({
        id:       page.id,
        kind,
        n:        getTitle('Name') || getTitle('Full Name'),
        skills:   getMulti('Skills').concat(getMulti('Services')).concat(getMulti('Role')),
        industry: p['Industry']?.select?.name ?? getText('Industry'),
        i:        getText('IG') || getText('Instagram'),
        e:        p['Email']?.email ?? getText('Email'),
        p:        p['Phone']?.phone_number ?? '',
        notes:    getText('Notes') || getText('Description'),
        status:   p['Status']?.select?.name ?? '',
        url:      page.url,
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return results;
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const [supply, demand] = await Promise.all([
    queryDB(SUPPLY_DB, 'supply'),
    queryDB(DEMAND_DB, 'demand'),
  ]);

  return new Response(JSON.stringify({ supply, demand }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
