export const prerender = false;

import type { APIRoute } from 'astro';
import { notionQuery } from '../../../lib/notion';
import { PADEL } from '../../../lib/padel-config';

const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? '';

function auth(request: Request): boolean {
  const h = request.headers.get('x-admin-key') ?? '';
  return h === ADMIN_KEY && ADMIN_KEY !== '';
}

export const GET: APIRoute = async ({ request, url }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  let rows: any[];
  try { rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID); }
  catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 502 }); }

  const attendees = rows.map((r: any) => {
    const p = r.properties;
    return {
      id:          r.id,
      name:        (p['Name']?.title ?? []).map((t: any) => t.plain_text).join(''),
      email:       p['Email']?.email ?? '',
      ticketType:  p['Ticket Type']?.select?.name ?? '',
      playing:     p['Playing']?.select?.name ?? '',
      amount:      p['Amount']?.number ?? 0,
      purchasedAt: p['Purchased At']?.date?.start ?? '',
      tier:        p['Tier']?.select?.name ?? '',
      formCompleted: p['Form Completed']?.checkbox ?? false,
      consent:     p['Consent']?.checkbox ?? false,
      business:    (p['Business']?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
      description: (p['Business Description']?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
      stage:       p['Stage']?.select?.name ?? '',
      workingOn:   (p['Working On']?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
      whoToMeet:   (p['Who to Meet']?.multi_select ?? []).map((t: any) => t.name),
      offer:       (p['Offer']?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
      paymentId:   (p['Payment ID']?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
      refunded:    p['Refunded']?.checkbox ?? false,
      transferLog: (p['Transfer Log']?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
    };
  });

  // CSV export
  if (url.searchParams.get('format') === 'csv') {
    const consented = attendees.filter(a => a.consent);
    const headers = ['Name','Email','Ticket Type','Playing','Amount','Purchased At','Business','Description','Stage','Working On','Who to Meet','Offer'];
    const rows2 = consented.map(a => [
      a.name, a.email, a.ticketType, a.playing, a.amount, a.purchasedAt,
      a.business, a.description, a.stage, a.workingOn,
      a.whoToMeet.join('; '), a.offer,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows2].join('\n');
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="padel-attendees.csv"',
      },
    });
  }

  const active   = attendees.filter(a => !a.refunded);
  const total    = active.length;
  const players  = active.filter(a => a.playing === 'Yes').length;
  const social   = total - players;
  const revenue  = active.reduce((s, a) => s + (a.amount ?? 0), 0);
  const formDone = active.filter(a => a.formCompleted).length;

  return new Response(JSON.stringify({
    stats: {
      total, players, social, revenue,
      formCompleted: formDone,
      formPending:   total - formDone,
      formPct:       total ? Math.round((formDone / total) * 100) : 0,
      breakEven:     PADEL.BREAK_EVEN,
      playerCap:     PADEL.PLAYER_CAP,
      totalCap:      PADEL.TICKET_CAP,
    },
    attendees,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
