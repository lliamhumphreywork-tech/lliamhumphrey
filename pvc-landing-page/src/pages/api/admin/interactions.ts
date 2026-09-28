export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const ADMIN_KEY    = import.meta.env.ADMIN_KEY;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (!ADMIN_KEY || request.headers.get('x-admin-key') !== ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const pageId = url.searchParams.get('pageId');
  if (!pageId) return new Response('Missing pageId', { status: 400 });

  const entries: { text: string }[] = [];
  let cursor: string | undefined;

  do {
    const fetchUrl = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    fetchUrl.searchParams.set('page_size', '100');
    if (cursor) fetchUrl.searchParams.set('start_cursor', cursor);

    const res = await fetch(fetchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!res.ok) return new Response(await res.text(), { status: res.status });

    const data = await res.json();

    for (const block of data.results ?? []) {
      if (block.type === 'paragraph') {
        const text = (block.paragraph?.rich_text ?? [])
          .map((t: any) => t.plain_text)
          .join('');
        if (text.trim()) entries.push({ text });
      }
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  // Reverse so newest is first
  entries.reverse();

  return new Response(JSON.stringify(entries), {
    headers: { 'Content-Type': 'application/json' },
  });
};
