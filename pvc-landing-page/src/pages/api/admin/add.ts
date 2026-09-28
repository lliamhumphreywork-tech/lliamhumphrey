export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DB_ID = '872bd20eee31468f91bed1cd472e157a';
const ADMIN_KEY = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const { name, insta, biz, interaction, notes, type } = await request.json();
  if (!name) return new Response('Name required', { status: 400 });

  const notesContent = notes ?? '';
  const types = type ? [type] : ['IG Lead'];
  const lastInteraction = interaction || 'DM on Instagram';

  const body = {
    parent: { database_id: NOTION_DB_ID },
    properties: {
      Name:               { title: [{ text: { content: name } }] },
      Business:           { rich_text: [{ text: { content: biz ?? '' } }] },
      Type:               { multi_select: types.map((n: string) => ({ name: n })) },
      Status:             { select: { name: 'Applied' } },
      'Last Interaction': { select: { name: lastInteraction } },
      IG:                 { rich_text: [{ text: { content: insta ?? '' } }] },
      Notes:              { rich_text: [{ text: { content: notesContent } }] },
    },
  };

  const res = await fetch('https://api.notion.com/v1/pages', {
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
  return new Response(JSON.stringify({ id: data.id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
