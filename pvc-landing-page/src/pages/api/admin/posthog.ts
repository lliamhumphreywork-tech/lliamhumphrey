export const prerender = false;
import type { APIRoute } from 'astro';

const POSTHOG_KEY  = import.meta.env.POSTHOG_API_KEY;
const POSTHOG_HOST = 'https://eu.posthog.com';
const PROJECT_ID   = '230565';
const ADMIN_KEY    = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function hogql(query: string) {
  const res = await fetch(`${POSTHOG_HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POSTHOG_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PostHog ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function scalar(query: string): Promise<number> {
  const data = await hogql(query);
  return Number(data.results?.[0]?.[0] ?? 0);
}

async function rows(query: string): Promise<any[][]> {
  const data = await hogql(query);
  return data.results ?? [];
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });
  if (!POSTHOG_KEY) {
    return new Response(JSON.stringify({ noKey: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [pv7, pv30, uv7, apply30, trend7, topPages] = await Promise.all([
      scalar(`SELECT count() FROM events WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay(7)`),
      scalar(`SELECT count() FROM events WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay(30)`),
      scalar(`SELECT count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay(7)`),
      scalar(`SELECT count() FROM events WHERE event = 'apply_modal_opened' AND timestamp >= now() - toIntervalDay(30)`),
      rows(`SELECT toDate(timestamp) AS day, count() AS views FROM events WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay(7) GROUP BY day ORDER BY day ASC`),
      rows(`SELECT properties.$pathname AS page, count() AS views FROM events WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay(30) AND properties.$pathname IS NOT NULL GROUP BY page ORDER BY views DESC LIMIT 8`),
    ]);

    return new Response(JSON.stringify({
      noKey: false,
      pageviews7:   pv7,
      pageviews30:  pv30,
      visitors7:    uv7,
      applyModal30: apply30,
      trend7: trend7.map((r: any[]) => ({ date: String(r[0]).slice(5), count: Number(r[1]) })),
      topPages: topPages.map((r: any[]) => ({ page: String(r[0]), count: Number(r[1]) })),
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
