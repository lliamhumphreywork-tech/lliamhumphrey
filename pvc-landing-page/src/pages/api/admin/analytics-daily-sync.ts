export const prerender = false;
import type { APIRoute } from 'astro';

const ADMIN_KEY        = import.meta.env.ADMIN_KEY ?? '';
const NOTION_TOKEN     = import.meta.env.NOTION_TOKEN ?? '';
const POSTHOG_API_KEY  = import.meta.env.POSTHOG_API_KEY ?? '';
const POSTHOG_PROJECT  = '230565';
const POSTHOG_HOST     = 'https://eu.posthog.com';
const ANALYTICS_DB_ID  = '200a8885-c970-40aa-be72-4a00d267c37d';

const NOTION_HEADERS = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
};

interface EventCounts {
  pageviews: number;
  applyPageVisits: number;
  ctaScrolled: number;
  applicationsSubmitted: number;
  sourceBreakdown: Record<string, number>;
}

async function fetchPostHogCounts(date: string): Promise<EventCounts> {
  const after  = `${date}T00:00:00Z`;
  const before = `${date}T23:59:59Z`;

  const query = async (event: string) => {
    const res = await fetch(
      `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT}/events/?event=${encodeURIComponent(event)}&after=${after}&before=${before}&limit=1000`,
      { headers: { Authorization: `Bearer ${POSTHOG_API_KEY}` } },
    );
    if (!res.ok) throw new Error(`PostHog error ${res.status} for ${event}`);
    const data = await res.json();
    return (data.results ?? []) as any[];
  };

  const [pageviewEvents, applyPageEvents, ctaEvents, submittedEvents] = await Promise.all([
    query('page_viewed'),
    query('page_viewed'),   // filtered below by page prop
    query('apply_cta_scrolled_past'),
    query('application_submitted'),
  ]);

  // page_viewed with page='apply' are apply page visits; rest are homepage
  const applyPageVisits = applyPageEvents.filter((e: any) => e.properties?.page === 'apply').length;
  const pageviews       = pageviewEvents.filter((e: any) => e.properties?.page !== 'apply').length;

  // Source breakdown from all page_viewed events
  const sourceBreakdown: Record<string, number> = {};
  for (const e of pageviewEvents) {
    const src = e.properties?.utm_source || e.properties?.referrer || 'direct';
    const key = src === 'direct' ? 'direct' : src;
    sourceBreakdown[key] = (sourceBreakdown[key] ?? 0) + 1;
  }

  return {
    pageviews,
    applyPageVisits,
    ctaScrolled: ctaEvents.length,
    applicationsSubmitted: submittedEvents.length,
    sourceBreakdown,
  };
}

async function upsertNotionRecord(date: string, counts: EventCounts): Promise<void> {
  // Check if a record for this date already exists
  const searchRes = await fetch(`https://api.notion.com/v1/databases/${ANALYTICS_DB_ID}/query`, {
    method: 'POST',
    headers: NOTION_HEADERS,
    body: JSON.stringify({
      filter: { property: 'Date', date: { equals: date } },
      page_size: 1,
    }),
  });
  if (!searchRes.ok) throw new Error(`Notion search error ${searchRes.status}`);
  const { results } = await searchRes.json();

  const topSource = Object.entries(counts.sourceBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';
  const sourceJson = JSON.stringify(counts.sourceBreakdown);

  const properties = {
    Name:                    { title: [{ text: { content: date } }] },
    Date:                    { date: { start: date } },
    Pageviews:               { number: counts.pageviews },
    'Apply CTA Scrolled':    { number: counts.ctaScrolled },
    'Apply Page Visits':     { number: counts.applyPageVisits },
    'Applications Submitted':{ number: counts.applicationsSubmitted },
    'Top Source':            { rich_text: [{ text: { content: topSource } }] },
    'Source Breakdown':      { rich_text: [{ text: { content: sourceJson } }] },
  };

  if (results?.length) {
    // Update existing
    const pageId = results[0].id;
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: NOTION_HEADERS,
      body: JSON.stringify({ properties }),
    });
    if (!res.ok) throw new Error(`Notion patch error ${res.status}`);
  } else {
    // Create new
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: NOTION_HEADERS,
      body: JSON.stringify({ parent: { database_id: ANALYTICS_DB_ID }, properties }),
    });
    if (!res.ok) throw new Error(`Notion create error ${res.status}: ${await res.text()}`);
  }
}

async function runSync(request: Request): Promise<Response> {
  const isCron = request.headers.get('x-vercel-cron') === '1';
  if (!isCron && (!ADMIN_KEY || request.headers.get('x-admin-key') !== ADMIN_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Default to yesterday; allow override via ?date=YYYY-MM-DD
  const url    = new URL(request.url);
  const target = url.searchParams.get('date') ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  try {
    const counts = await fetchPostHogCounts(target);
    await upsertNotionRecord(target, counts);
    console.log(`[analytics-daily-sync] ${target} — ${counts.pageviews} views, ${counts.applicationsSubmitted} submissions`);
    return new Response(JSON.stringify({ ok: true, date: target, ...counts }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[analytics-daily-sync] Error:', e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const GET: APIRoute  = ({ request }) => runSync(request);
export const POST: APIRoute = ({ request }) => runSync(request);
