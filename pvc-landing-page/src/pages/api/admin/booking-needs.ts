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

  let pages: any[];
  try {
    pages = await notionQuery(NOTION_CRM, {
      and: [
        { property: 'Status', select: { equals: 'Accepted' } },
        { property: 'Booking Email Sent', date: { is_not_empty: true } },
      ],
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const needsBooking = pages
    .map(page => {
      const p           = page.properties;
      const fullName    = getTitle(p, 'Name');
      const sentDate    = getDate(p, 'Booking Email Sent');
      return {
        id:             page.id,
        name:           fullName,
        firstName:      fullName.split(' ')[0] || '',
        email:          getEmail(p, 'Email'),
        phone:          getPhone(p, 'Phone'),
        daysSinceEmail: sentDate ? daysSince(sentDate) : 0,
        followupCount:  getNum(p, 'Follow-up Count') ?? 0,
      };
    })
    .sort((a, b) => b.daysSinceEmail - a.daysSinceEmail);

  return new Response(JSON.stringify({ needsBooking }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
