export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN         = import.meta.env.NOTION_TOKEN;
const NOTION_FINANCE_DB_ID = import.meta.env.NOTION_FINANCE_DB_ID;
const ADMIN_KEY            = import.meta.env.ADMIN_KEY;
const PAYSTACK_SECRET      = import.meta.env.PAYSTACK_SECRET_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function queryNotion() {
  if (!NOTION_FINANCE_DB_ID || !NOTION_TOKEN) return [];
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

async function queryPaystack() {
  if (!PAYSTACK_SECRET) return [];
  const payments: any[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`https://api.paystack.co/transaction?perPage=100&page=${page}&status=success`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    if (!res.ok) break;
    const data = await res.json();
    const txns = data.data ?? [];
    for (const t of txns) {
      payments.push({
        reference: t.reference,
        name: `${t.customer?.first_name ?? ''} ${t.customer?.last_name ?? ''}`.trim() || t.customer?.email?.split('@')[0] || 'Customer',
        email: t.customer?.email ?? '',
        amount: t.amount / 100,
        item: t.metadata?.item_name ?? t.plan_object?.name ?? t.metadata?.custom_fields?.find((f: any) => f.variable_name === 'item_name')?.value ?? 'PVC Payment',
        category: detectCategory(t.metadata?.item_name ?? t.plan_object?.name ?? ''),
        date: (t.paid_at ?? t.created_at ?? '').slice(0, 10),
        source: 'paystack',
      });
    }
    if (page >= (data.meta?.pageCount ?? 1)) break;
    page++;
  }
  return payments;
}


function detectCategory(itemName: string): string {
  const lower = (itemName ?? '').toLowerCase();
  if (lower.includes('membership')) return 'Membership';
  if (lower.includes('event') || lower.includes('dinner') || lower.includes('ticket') ||
      lower.includes('admission') || lower.includes('mastermind') || lower.includes('summit') ||
      lower.includes('cape town') || lower.includes('workshop')) return 'Event';
  return 'Other';
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const [notionPages, paystackPayments] = await Promise.all([queryNotion(), queryPaystack()]);

  const notionByRef: Record<string, boolean> = {};
  const notionPayments = notionPages.map(p => {
    const props = p.properties;
    const getText  = (k: string) => (props[k]?.rich_text ?? []).map((t: any) => t.plain_text).join('');
    const getTitle = (k: string) => (props[k]?.title ?? []).map((t: any) => t.plain_text).join('');
    const ref = getText('Payment ID');
    if (ref) notionByRef[ref] = true;
    return {
      reference: ref,
      name: getTitle('Entry Name'),
      email: props['Email']?.email ?? '',
      amount: props['Amount']?.number ?? 0,
      item: getText('Item'),
      category: props['Category']?.select?.name ?? 'Other',
      date: props['Date']?.date?.start ?? '',
      source: 'notion',
    };
  }).filter(p => p.amount > 0);

  const newPaystack = paystackPayments.filter(p => p.reference && !notionByRef[p.reference]);

  const payments = [...notionPayments, ...newPaystack]
    .filter(p => p.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const total     = payments.reduce((s, p) => s + p.amount, 0);
  const thisMonth = payments
    .filter(p => p.date?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, p) => s + p.amount, 0);

  const byCategory: Record<string, number> = {};
  const byItem: Record<string, { amount: number; count: number }> = {};
  for (const p of payments) {
    byCategory[p.category] = (byCategory[p.category] ?? 0) + p.amount;
    if (!byItem[p.item]) byItem[p.item] = { amount: 0, count: 0 };
    byItem[p.item].amount += p.amount;
    byItem[p.item].count  += 1;
  }

  const recent = payments.slice(0, 20);

  return new Response(JSON.stringify({
    total, thisMonth, byCategory, byItem, recent, count: payments.length,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
