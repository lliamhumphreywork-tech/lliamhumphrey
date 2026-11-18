export const prerender = false;

import type { APIRoute } from 'astro';
import { notionQuery, notionPatch, checkProp } from '../../../lib/notion';
import { sendTemplate } from '../../../lib/brevo';
import { PADEL } from '../../../lib/padel-config';

const CRON_SECRET = import.meta.env.CRON_SECRET ?? '';
const SITE_URL    = 'https://privatevictoriesclub.com';

// Reminder email template IDs (create these in Brevo)
const TEMPLATE_REMINDER = 33;

export const GET: APIRoute = async ({ request, url }) => {
  const auth = request.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${CRON_SECRET}` || !CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Determine which reminder to send based on today's date (SAST)
  const now    = new Date();
  const dateStr = now.toISOString().split('T')[0]; // e.g. "2026-12-02"
  const is2Dec = dateStr === '2026-12-02';
  const is7Dec = dateStr === '2026-12-07';

  if (!is2Dec && !is7Dec) {
    // Allow manual override via ?force=1 for testing
    if (url.searchParams.get('force') !== '1') {
      return new Response('Not a reminder date', { status: 200 });
    }
  }

  const reminderField = is7Dec ? 'Reminder 7 Dec Sent' : 'Reminder 2 Dec Sent';
  const daysLeft = is7Dec ? '4' : '9';

  // Find all buyers who haven't completed the form yet and haven't had this reminder
  let rows: any[] = [];
  try { rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID); } catch (e: any) {
    return new Response(`Notion error: ${e.message}`, { status: 502 });
  }

  const targets = rows.filter((r: any) => {
    const p = r.properties;
    return !p['Form Completed']?.checkbox && !p[reminderField]?.checkbox;
  });

  let sent = 0;
  for (const row of targets) {
    const p        = row.properties;
    const email    = p['Email']?.email ?? '';
    const name     = (p['Name']?.title ?? []).map((t: any) => t.plain_text).join('');
    const token    = (p['Form Token']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
    const paymentId = (p['Payment ID']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
    if (!email || !token || !paymentId) continue;

    const formLink = `${SITE_URL}/padel-confirm?token=${token}&ref=${paymentId}`;
    try {
      await sendTemplate(TEMPLATE_REMINDER, { email, name: name.split(' ')[0] }, {
        firstName: name.split(' ')[0],
        formLink,
        daysLeft,
        formCloseDate: '8 December at 23:59',
      });
      await notionPatch(row.id, { [reminderField]: checkProp(true) });
      sent++;
    } catch (e: any) {
      console.error(`[padel-reminder] Failed to send to ${email}:`, e.message);
    }
  }

  return new Response(JSON.stringify({ sent, total: targets.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
