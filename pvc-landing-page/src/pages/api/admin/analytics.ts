export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN   = import.meta.env.NOTION_TOKEN;
const NOTION_CRM_DB  = '872bd20eee31468f91bed1cd472e157a';
const BREVO_API_KEY  = import.meta.env.BREVO_API_KEY;
const TALLY_API_KEY  = import.meta.env.TALLY_API_KEY;
const ADMIN_KEY      = import.meta.env.ADMIN_KEY;

const TALLY_FORMS = [
  { id: 'J94gk4', name: 'CT Mastermind Application' },
  { id: 'jarg7Y', name: 'Membership Application' },
  { id: 'dWJdNz', name: 'Talent Network' },
];

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
    const res = await fetch('https://api.brevo.com/v3/emailCampaigns?type=classic&status=sent&limit=15&statistics=globalStats', {
      headers: { 'api-key': BREVO_API_KEY, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.campaigns ?? []).map((c: any) => {
      // Brevo returns stats under statistics.globalStats or directly at top-level stats
      const gs        = c.statistics?.globalStats ?? c.statistics ?? {};
      const sent      = gs.sent ?? gs.messagesSent ?? c.statistics?.sent ?? 0;
      const delivered = gs.delivered ?? gs.deliveredCount ?? sent;
      const opens     = gs.uniqueViews ?? gs.uniqueOpens ?? gs.opened ?? 0;
      const clicks    = gs.clickers ?? gs.uniqueClicks ?? 0;
      return {
        id:           c.id,
        name:         c.name,
        subject:      c.subject,
        sentAt:       c.sentDate ?? '',
        sent,
        delivered,
        opens,
        clicks,
        openRate:     delivered > 0 ? opens / delivered : 0,
        clickRate:    delivered > 0 ? clicks / delivered : 0,
        unsubscribed: gs.unsubscriptions ?? gs.unsubscribed ?? 0,
        bounces:      (gs.softBounces ?? 0) + (gs.hardBounces ?? 0),
      };
    });
  } catch {
    return [];
  }
}

async function getTallyStats() {
  if (!TALLY_API_KEY) {
    return TALLY_FORMS.map(f => ({ ...f, views: null, responses: null, conversionRate: null }));
  }
  return Promise.all(TALLY_FORMS.map(async (form) => {
    try {
      // Use submissions endpoint — totalNumberOfSubmissionsPerFilter is always present
      const res = await fetch(`https://api.tally.so/forms/${form.id}/submissions?page=1&limit=1`, {
        headers: { Authorization: `Bearer ${TALLY_API_KEY}` },
      });
      if (!res.ok) return { ...form, views: null, responses: null, conversionRate: null };
      const data = await res.json();
      const responses = data.totalNumberOfSubmissionsPerFilter ?? data.total ?? null;
      // Tally's API does not expose view counts; skip conversion rate
      return { id: form.id, name: form.name, views: null, responses, conversionRate: null };
    } catch {
      return { ...form, views: null, responses: null, conversionRate: null };
    }
  }));
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const [crmStats, campaigns, tallyForms] = await Promise.all([
    getCrmStats(),
    getBrevoStats(),
    getTallyStats(),
  ]);

  return new Response(JSON.stringify({ crmStats, campaigns, tallyForms }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
