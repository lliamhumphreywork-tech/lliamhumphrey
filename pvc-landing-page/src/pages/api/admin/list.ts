export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DB_ID = '872bd20eee31468f91bed1cd472e157a';
const ADMIN_KEY = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

function parsePerson(page: any) {
  const p = page.properties;
  const nameArr = p['Name']?.title ?? [];
  const name = nameArr.map((t: any) => t.plain_text).join('');
  const bizArr = p['Business']?.rich_text ?? [];
  const biz = bizArr.map((t: any) => t.plain_text).join('');
  const notesArr = p['Notes']?.rich_text ?? [];
  const notes = notesArr.map((t: any) => t.plain_text).join('');
  const types = (p['Type']?.multi_select ?? []).map((s: any) => s.name);
  return {
    id: page.id,
    name,
    biz,
    notes,
    score: p['Application Score']?.number ?? null,
    type: types,
    invited: p['Invited?']?.checkbox ?? false,
    confirmed: p['Confirmed?']?.checkbox ?? false,
    paid: p['Paid?']?.checkbox ?? false,
    ticketSent: p['Ticket Sent?']?.checkbox ?? false,
    attended: p['Attended?']?.checkbox ?? false,
    potentialMember: p['Potential Member?']?.checkbox ?? false,
  };
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const people: any[] = [];
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
    people.push(...(data.results ?? []).map(parsePerson));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return new Response(JSON.stringify(people), {
    headers: { 'Content-Type': 'application/json' },
  });
};
