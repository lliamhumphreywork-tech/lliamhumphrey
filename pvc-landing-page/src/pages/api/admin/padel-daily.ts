export const prerender = false;

import type { APIRoute } from 'astro';
import { notionQuery } from '../../../lib/notion';
import { postWebhook } from '../../../lib/slack';
import { PADEL } from '../../../lib/padel-config';

const CRON_SECRET   = import.meta.env.CRON_SECRET ?? '';
const SLACK_URL     = import.meta.env.SLACK_FINANCE_URL ?? '';

export const GET: APIRoute = async ({ request }) => {
  // Vercel cron passes Authorization: Bearer <CRON_SECRET>
  const auth = request.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${CRON_SECRET}` || !CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let rows: any[] = [];
  try { rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID); } catch { /* log but continue */ }

  const total      = rows.length;
  const players    = rows.filter((r: any) => r.properties['Playing']?.select?.name === 'Yes').length;
  const formDone   = rows.filter((r: any) => r.properties['Form Completed']?.checkbox).length;
  const formPct    = total ? Math.round((formDone / total) * 100) : 0;
  const revenue    = rows.reduce((s: number, r: any) => s + (r.properties['Amount']?.number ?? 0), 0);
  const remaining  = PADEL.TICKET_CAP - total;

  const msg = [
    `📊 *Padel Daily Update — ${new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}*`,
    `*Sold:* ${total}/${PADEL.TICKET_CAP} (${remaining} left) | ${players} playing, ${total - players} social`,
    `*Revenue:* R${revenue.toFixed(0)} | Break-even: ${PADEL.BREAK_EVEN} guests`,
    `*Profiles:* ${formDone}/${total} complete (${formPct}%)`,
  ].join('\n');

  try {
    await postWebhook(SLACK_URL, msg);
    return new Response('OK', { status: 200 });
  } catch (e: any) {
    return new Response(`Slack error: ${e.message}`, { status: 502 });
  }
};
