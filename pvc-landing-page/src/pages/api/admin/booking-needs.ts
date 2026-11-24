export const prerender = false;
import type { APIRoute } from 'astro';
import { notionQuery, getTitle, getEmail, getPhone, getDate, getNum, getSelect } from '../../../lib/notion';

const ADMIN_KEY  = import.meta.env.ADMIN_KEY ?? '';
const NOTION_CRM = '872bd20eee31468f91bed1cd472e157a';

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  let withDate: any[];
  let noDate: any[];
  try {
    [withDate, noDate] = await Promise.all([
      notionQuery(NOTION_CRM, {
        and: [
          { property: 'Status', select: { equals: 'Accepted' } },
          { property: 'Booking Email Sent', date: { is_not_empty: true } },
        ],
      }),
      notionQuery(NOTION_CRM, {
        and: [
          { property: 'Status', select: { equals: 'Accepted' } },
          { property: 'Booking Email Sent', date: { is_empty: true } },
        ],
      }),
    ]);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  function mapPage(page: any) {
    const p        = page.properties;
    const fullName = getTitle(p, 'Name');
    const sentDate = getDate(p, 'Booking Email Sent');
    return {
      id:             page.id,
      name:           fullName,
      firstName:      fullName.split(' ')[0] || '',
      email:          getEmail(p, 'Email'),
      phone:          getPhone(p, 'Phone'),
      daysSinceEmail: sentDate ? daysSince(sentDate) : null,
      followupCount:  getNum(p, 'Follow-up Count') ?? 0,
    };
  }

  const needsBooking = withDate.map(mapPage).sort((a, b) => (b.daysSinceEmail ?? 0) - (a.daysSinceEmail ?? 0));
  const noDateLeads  = noDate.map(mapPage).sort((a, b) => a.name.localeCompare(b.name));

  return new Response(JSON.stringify({ needsBooking, noDateLeads }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
