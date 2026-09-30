export const prerender = false;
import type { APIRoute } from 'astro';

const POSTHOG_KEY   = import.meta.env.POSTHOG_API_KEY;
const POSTHOG_HOST  = 'https://eu.posthog.com';
const PROJECT_ID    = '230565';
const ADMIN_KEY     = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function phGet(path: string) {
  const res = await fetch(`${POSTHOG_HOST}${path}`, {
    headers: { Authorization: `Bearer ${POSTHOG_KEY}` },
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}`);
  return res.json();
}

async function getTrend(eventName: string, days: number, math = 'total') {
  const dateFrom = `-${days}d`;
  const url = `/api/projects/${PROJECT_ID}/insights/trend/?events=${encodeURIComponent(JSON.stringify([{ id: eventName, math }]))}&date_from=${dateFrom}&interval=day`;
  const data = await phGet(url);
  const series = data.result?.[0];
  if (!series) return { total: 0, data: [] };
  const total = (series.data ?? []).reduce((s: number, v: number) => s + v, 0);
  return {
    total,
    data: (series.days ?? []).map((d: string, i: number) => ({ date: d, count: series.data?.[i] ?? 0 })),
  };
}

async function getTopPages(days: number) {
  const dateFrom = `-${days}d`;
  const breakdown = encodeURIComponent(JSON.stringify('$current_url'));
  const events = encodeURIComponent(JSON.stringify([{ id: '$pageview', math: 'total' }]));
  const url = `/api/projects/${PROJECT_ID}/insights/trend/?events=${events}&date_from=${dateFrom}&breakdown=${breakdown}&breakdown_type=event&interval=day`;
  const data = await phGet(url);
  const pages: Record<string, number> = {};
  for (const series of data.result ?? []) {
    const url = (series.breakdown_value ?? '').replace(/https?:\/\/[^/]+/, '');
    if (!url || url === '') continue;
    const count = (series.data ?? []).reduce((s: number, v: number) => s + v, 0);
    pages[url] = (pages[url] ?? 0) + count;
  }
  return Object.entries(pages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([page, count]) => ({ page, count }));
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });
  if (!POSTHOG_KEY) return new Response(JSON.stringify({ noKey: true }), { headers: { 'Content-Type': 'application/json' } });

  try {
    const [pv7, pv30, uv7, applyModal7, topPages] = await Promise.all([
      getTrend('$pageview', 7),
      getTrend('$pageview', 30),
      getTrend('$pageview', 7, 'dau'),
      getTrend('apply_modal_opened', 30),
      getTopPages(30),
    ]);

    return new Response(JSON.stringify({
      noKey: false,
      pageviews7:   pv7.total,
      pageviews30:  pv30.total,
      visitors7:    uv7.total,
      applyModal30: applyModal7.total,
      trend7:       pv7.data,
      topPages,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
