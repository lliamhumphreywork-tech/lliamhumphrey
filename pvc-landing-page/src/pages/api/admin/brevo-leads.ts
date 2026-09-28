export const prerender = false;
import type { APIRoute } from 'astro';

const ADMIN_KEY  = import.meta.env.ADMIN_KEY;
const BREVO_KEY  = import.meta.env.BREVO_API_KEY;
const BREVO_HDRS = { 'api-key': BREVO_KEY ?? '', 'Accept': 'application/json' };

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function getEvents(event: 'opened' | 'clicks', limit = 500): Promise<any[]> {
  const res  = await fetch(
    `https://api.brevo.com/v3/smtp/statistics/events?event=${event}&limit=${limit}`,
    { headers: BREVO_HDRS }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.events ?? [];
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });
  if (!BREVO_KEY)     return json({ contacts: [], eventCount: 0, error: 'BREVO_API_KEY not set' });

  try {
    const [opens, clicks] = await Promise.all([
      getEvents('opened', 500),
      getEvents('clicks', 500),
    ]);

    const engagementMap: Record<string, { email: string; opens: number; clicks: number }> = {};

    for (const ev of opens) {
      const email = ev.email;
      if (!email) continue;
      if (!engagementMap[email]) engagementMap[email] = { email, opens: 0, clicks: 0 };
      engagementMap[email].opens++;
    }
    for (const ev of clicks) {
      const email = ev.email;
      if (!email) continue;
      if (!engagementMap[email]) engagementMap[email] = { email, opens: 0, clicks: 0 };
      engagementMap[email].clicks++;
    }

    const sorted = Object.values(engagementMap)
      .sort((a, b) => (b.opens + b.clicks * 2) - (a.opens + a.clicks * 2))
      .slice(0, 30);

    return json({ contacts: sorted, eventCount: opens.length + clicks.length });
  } catch (e: any) {
    console.error('[brevo-leads]', e.message);
    return json({ contacts: [], eventCount: 0, error: e.message });
  }
};

function json(data: object) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}
