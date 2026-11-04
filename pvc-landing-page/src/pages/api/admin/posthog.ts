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
    const [
      // Landing page
      landingPV7, landingPV30, landingUV30,
      // Apply page
      applyPV7, applyPV30,
      // Funnel events (30d)
      ctaScrolled30, applySubmitted30, callBooked30, paymentCompleted30, onboardingSubmitted30,
      // Landing page CTA interactions (30d)
      landingCTAClicks30,
      // 7-day trend for landing page
      landingTrend7,
      // Apply page 7-day trend
      applyTrend7,
      // UTM sources — traffic (30d)
      utmSources30,
      // UTM sources — submissions (30d)
      utmSourcesSubmitted30,
      // UTM campaigns (30d)
      utmCampaigns30,
      // UTM mediums (30d)
      utmMediums30,
      // UTM campaigns with submissions
      utmCampaignsSubmitted30,
    ] = await Promise.all([
      // Landing page pageviews
      scalar(`SELECT count() FROM events WHERE event = '$pageview' AND properties.$pathname = '/' AND timestamp >= now() - toIntervalDay(7)`),
      scalar(`SELECT count() FROM events WHERE event = '$pageview' AND properties.$pathname = '/' AND timestamp >= now() - toIntervalDay(30)`),
      scalar(`SELECT count(DISTINCT distinct_id) FROM events WHERE event = '$pageview' AND properties.$pathname = '/' AND timestamp >= now() - toIntervalDay(30)`),

      // Apply page pageviews
      scalar(`SELECT count() FROM events WHERE event = '$pageview' AND properties.$pathname = '/apply' AND timestamp >= now() - toIntervalDay(7)`),
      scalar(`SELECT count() FROM events WHERE event = '$pageview' AND properties.$pathname = '/apply' AND timestamp >= now() - toIntervalDay(30)`),

      // Funnel
      scalar(`SELECT count() FROM events WHERE event = 'apply_cta_scrolled_past' AND timestamp >= now() - toIntervalDay(30)`),
      scalar(`SELECT count() FROM events WHERE event = 'application_submitted' AND timestamp >= now() - toIntervalDay(30)`),
      scalar(`SELECT count() FROM events WHERE event = 'call_booked' AND timestamp >= now() - toIntervalDay(30)`),
      scalar(`SELECT count() FROM events WHERE event = 'payment_completed' AND timestamp >= now() - toIntervalDay(30)`),
      scalar(`SELECT count() FROM events WHERE (event = 'onboarding_submitted' OR (event = '$pageview' AND properties.$pathname = '/onboardingform')) AND timestamp >= now() - toIntervalDay(30)`),

      // Landing CTA button clicks
      scalar(`SELECT count() FROM events WHERE event IN ('apply_button_clicked','apply_cta_clicked','cta_clicked') AND timestamp >= now() - toIntervalDay(30)`),

      // Landing page trend
      rows(`SELECT toDate(timestamp) AS day, count() AS views FROM events WHERE event = '$pageview' AND properties.$pathname = '/' AND timestamp >= now() - toIntervalDay(7) GROUP BY day ORDER BY day ASC`),

      // Apply page trend
      rows(`SELECT toDate(timestamp) AS day, count() AS views FROM events WHERE event = '$pageview' AND properties.$pathname = '/apply' AND timestamp >= now() - toIntervalDay(7) GROUP BY day ORDER BY day ASC`),

      // UTM sources — traffic
      rows(`SELECT coalesce(nullIf(properties.$utm_source, ''), nullIf(properties.$initial_utm_source, ''), '(direct)') AS src, count() AS views FROM events WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay(30) GROUP BY src ORDER BY views DESC LIMIT 10`),

      // UTM sources — submissions
      rows(`SELECT coalesce(nullIf(properties.$utm_source, ''), nullIf(properties.$initial_utm_source, ''), '(direct)') AS src, count() AS subs FROM events WHERE event = 'application_submitted' AND timestamp >= now() - toIntervalDay(30) GROUP BY src ORDER BY subs DESC LIMIT 10`),

      // UTM campaigns — traffic
      rows(`SELECT coalesce(nullIf(properties.$utm_campaign, ''), nullIf(properties.$initial_utm_campaign, ''), '(none)') AS campaign, count() AS views FROM events WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay(30) GROUP BY campaign ORDER BY views DESC LIMIT 10`),

      // UTM mediums — traffic
      rows(`SELECT coalesce(nullIf(properties.$utm_medium, ''), nullIf(properties.$initial_utm_medium, ''), '(none)') AS medium, count() AS views FROM events WHERE event = '$pageview' AND timestamp >= now() - toIntervalDay(30) GROUP BY medium ORDER BY views DESC LIMIT 8`),

      // UTM campaigns — submissions
      rows(`SELECT coalesce(nullIf(properties.$utm_campaign, ''), nullIf(properties.$initial_utm_campaign, ''), '(none)') AS campaign, count() AS subs FROM events WHERE event = 'application_submitted' AND timestamp >= now() - toIntervalDay(30) GROUP BY campaign ORDER BY subs DESC LIMIT 10`),
    ]);

    // Merge UTM source traffic + submissions
    const sourceSubMap: Record<string, number> = {};
    utmSourcesSubmitted30.forEach((r: any[]) => { sourceSubMap[String(r[0])] = Number(r[1]); });
    const utmSourceRows = utmSources30.map((r: any[]) => ({
      source: String(r[0]),
      views: Number(r[1]),
      submitted: sourceSubMap[String(r[0])] ?? 0,
    }));

    // Merge UTM campaign traffic + submissions
    const campaignSubMap: Record<string, number> = {};
    utmCampaignsSubmitted30.forEach((r: any[]) => { campaignSubMap[String(r[0])] = Number(r[1]); });
    const utmCampaignRows = utmCampaigns30.map((r: any[]) => ({
      campaign: String(r[0]),
      views: Number(r[1]),
      submitted: campaignSubMap[String(r[0])] ?? 0,
    }));

    return new Response(JSON.stringify({
      noKey: false,

      // Landing page
      landing: {
        pv7: landingPV7,
        pv30: landingPV30,
        uv30: landingUV30,
        ctaScrolled30,
        ctaClicks30: landingCTAClicks30,
        trend7: landingTrend7.map((r: any[]) => ({ date: String(r[0]).slice(5), count: Number(r[1]) })),
      },

      // Apply page
      apply: {
        pv7: applyPV7,
        pv30: applyPV30,
        submitted30: applySubmitted30,
        convRate: applyPV30 > 0 ? Math.round((applySubmitted30 / applyPV30) * 100) : 0,
        trend7: applyTrend7.map((r: any[]) => ({ date: String(r[0]).slice(5), count: Number(r[1]) })),
      },

      // Full funnel
      funnel: [
        { label: 'Landing page visits', count: landingPV30 },
        { label: 'Apply page visits', count: applyPV30 },
        { label: 'Applications submitted', count: applySubmitted30 },
        { label: 'Calls booked', count: callBooked30 },
        { label: 'Members paid', count: paymentCompleted30 },
        { label: 'Onboarding forms', count: onboardingSubmitted30 },
      ],

      // UTMs
      utmSources: utmSourceRows,
      utmCampaigns: utmCampaignRows,
      utmMediums: utmMediums30.map((r: any[]) => ({ medium: String(r[0]), views: Number(r[1]) })),

    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
