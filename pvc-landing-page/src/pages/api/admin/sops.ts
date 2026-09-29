export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN    = import.meta.env.NOTION_TOKEN;
const NOTION_SOPS_DB  = 'a6876254-52f2-456b-a2e0-5fc355f014af';
const ADMIN_KEY       = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_SOPS_DB}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ page_size: 100 }),
  });

  const data = await res.json();
  if (!res.ok) return new Response(JSON.stringify(data), { status: res.status });

  const sops = (data.results ?? []).map((page: any) => {
    const p = page.properties;
    const getText  = (k: string) => (p[k]?.rich_text ?? []).map((t: any) => t.plain_text).join('');
    const getTitle = (k: string) => (p[k]?.title     ?? []).map((t: any) => t.plain_text).join('');

    return {
      id:          page.id,
      title:       getTitle('Name') || getTitle('Title'),
      description: getText('Description') || getText('Notes') || getText('Summary'),
      category:    p['Category']?.select?.name ?? p['Type']?.select?.name ?? '',
      status:      p['Status']?.select?.name ?? '',
      updated:     page.last_edited_time?.slice(0, 10) ?? '',
      url:         page.url,
    };
  });

  return new Response(JSON.stringify(sops), {
    headers: { 'Content-Type': 'application/json' },
  });
};
