export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN         = import.meta.env.NOTION_TOKEN;
const NOTION_FINANCE_DB_ID = import.meta.env.NOTION_FINANCE_DB_ID;
const ADMIN_KEY            = import.meta.env.ADMIN_KEY;
const WHOP_API_KEY         = import.meta.env.WHOP_API_KEY;

function auth(req: Request) {
  return new URL(req.url).searchParams.get('key') === ADMIN_KEY;
}

async function queryNotion() {
  let results: any[] = [];
  let cursor: string | undefined;
  do {
    const body: any = { page_size: 100, filter: { property: 'Status', select: { equals: 'Complete' } } };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_FINANCE_DB_ID}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify(body),
    });
    if (!res.ok) break;
    const data = await res.json();
    results = results.concat(data.results ?? []);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function queryWhop(): Promise<number> {
  if (!WHOP_API_KEY) return 0;
  let total = 0;
  let page  = 1;
  while (true) {
    const res = await fetch(`https://api.whop.com/api/v2/payments?limit=100&page=${page}`, {
      headers: { Authorization: `Bearer ${WHOP_API_KEY}` },
    });
    if (!res.ok) break;
    const data = await res.json();
    for (const p of data.data ?? []) {
      if (p.status === 'paid' && p.final_amount > 0) total += p.final_amount;
    }
    if (page >= (data.pagination?.total_page ?? 1)) break;
    page++;
  }
  return total;
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const [pages, whopTotal] = await Promise.all([queryNotion(), queryWhop()]);

  const payments = pages.map(p => {
    const props = p.properties;
    const getText  = (k: string) => (props[k]?.rich_text ?? []).map((t: any) => t.plain_text).join('');
    const getTitle = (k: string) => (props[k]?.title     ?? []).map((t: any) => t.plain_text).join('');
    return {
      name:     getTitle('Entry Name'),
      email:    props['Email']?.email ?? '',
      amount:   props['Amount']?.number ?? 0,
      item:     getText('Item'),
      category: props['Category']?.select?.name ?? 'Other',
      date:     props['Date']?.date?.start ?? '',
    };
  }).filter(p => p.amount > 0);

  const notionTotal = payments.reduce((s, p) => s + p.amount, 0);
  const total       = notionTotal + whopTotal;
  const thisMonth   = payments.filter(p => p.date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, p) => s + p.amount, 0);

  const byCategory: Record<string, number> = {};
  const byItem: Record<string, { amount: number; count: number }> = {};
  for (const p of payments) {
    byCategory[p.category] = (byCategory[p.category] ?? 0) + p.amount;
    if (!byItem[p.item]) byItem[p.item] = { amount: 0, count: 0 };
    byItem[p.item].amount += p.amount;
    byItem[p.item].count  += 1;
  }

  const recent = payments
    .filter(p => p.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);

  return new Response(JSON.stringify({ total, notionTotal, whopTotal, thisMonth, byCategory, byItem, recent, count: payments.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
