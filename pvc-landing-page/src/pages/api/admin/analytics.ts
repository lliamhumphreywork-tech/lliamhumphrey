export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN    = import.meta.env.NOTION_TOKEN;
const NOTION_CRM_DB   = '872bd20eee31468f91bed1cd472e157a';
const BREVO_API_KEY   = import.meta.env.BREVO_API_KEY;
const ADMIN_KEY       = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function getCrmStats() {
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_CRM_DB}/query`, {
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
    all.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  const byType: Record<string, number>   = {};
  const byStatus: Record<string, number> = {};
  const byMonth: Record<string, number>  = {};

  for (const page of all) {
    const types  = (page.properties['Type']?.multi_select ?? []).map((s: any) => s.name);
    const status = page.properties['Status']?.select?.name ?? 'Unknown';
    const month  = page.created_time?.slice(0, 7) ?? '';

    for (const t of types) byType[t] = (byType[t] ?? 0) + 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (month) byMonth[month] = (byMonth[month] ?? 0) + 1;
  }

  return { total: all.length, byType, byStatus, byMonth };
}

async function getBrevoStats() {
  if (!BREVO_API_KEY) return [];
  try {
    const res = await fetch('https://api.brevo.com/v3/emailCampaigns?type=classic&status=sent&limit=10', {
      headers: { 'api-key': BREVO_API_KEY, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.campaigns ?? []).map((c: any) => ({
      id:           c.id,
      name:         c.name,
      subject:      c.subject,
      sentAt:       c.sentDate ?? '',
      delivered:    c.statistics?.globalStats?.delivered ?? 0,
      openRate:     c.statistics?.globalStats?.openRate ?? 0,
      clickRate:    c.statistics?.globalStats?.clickRate ?? 0,
      unsubscribed: c.statistics?.globalStats?.unsubscribed ?? 0,
    }));
  } catch {
    return [];
  }
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const [crmStats, campaigns] = await Promise.all([getCrmStats(), getBrevoStats()]);

  return new Response(JSON.stringify({ crmStats, campaigns }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
