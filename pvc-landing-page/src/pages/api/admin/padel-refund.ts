export const prerender = false;

import type { APIRoute } from 'astro';
import crypto from 'crypto';
import { notionQuery, notionPatch, selectProp, checkProp, textProp } from '../../../lib/notion';
import { sendTemplate } from '../../../lib/brevo';
import { postWebhook } from '../../../lib/slack';
import { PADEL, isRefundAllowed, buildPadelIcs } from '../../../lib/padel-config';

const ADMIN_KEY       = import.meta.env.ADMIN_KEY ?? '';
const PAYSTACK_SECRET = import.meta.env.PAYSTACK_SECRET_KEY ?? '';
const SLACK_URL       = import.meta.env.SLACK_FINANCE_URL ?? '';
const SITE_URL        = 'https://privatevictoriesclub.com';

function auth(request: Request): boolean {
  return (request.headers.get('x-admin-key') ?? '') === ADMIN_KEY && ADMIN_KEY !== '';
}

export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) return res(401, { error: 'Unauthorized' });

  let body: any;
  try { body = await request.json(); } catch { return res(400, { error: 'Invalid JSON' }); }

  const { pageId, force } = body ?? {};
  if (!pageId) return res(400, { error: 'Missing pageId' });

  // Fetch the Notion row
  let row: any;
  try {
    const rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID);
    row = rows.find((r: any) => r.id === pageId);
  } catch (e: any) {
    return res(502, { error: `Notion error: ${e.message}` });
  }
  if (!row) return res(404, { error: 'Ticket not found' });

  const p         = row.properties;
  const email     = p['Email']?.email ?? '';
  const name      = (p['Name']?.title ?? []).map((t: any) => t.plain_text).join('');
  const paymentId = (p['Payment ID']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
  const amount    = p['Amount']?.number ?? 0;
  const refunded  = p['Refunded']?.checkbox ?? false;

  if (refunded) return res(409, { error: 'Already refunded' });
  if (!paymentId) return res(400, { error: 'No payment ID on record' });

  // 7-day cutoff check (admin can override with force: true)
  if (!isRefundAllowed() && !force) {
    return res(409, {
      error: 'Refund window has closed (7 days before event). Pass force: true to override.',
      cutoffPassed: true,
    });
  }

  // Issue Paystack refund
  try {
    const psRes = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: paymentId }),
    });
    if (!psRes.ok) {
      const txt = await psRes.text();
      return res(502, { error: `Paystack refund error ${psRes.status}: ${txt.slice(0, 200)}` });
    }
  } catch (e: any) {
    return res(502, { error: `Paystack network error: ${e.message}` });
  }

  // Mark refunded in Notion
  await notionPatch(pageId, { 'Refunded': checkProp(true) });

  // Email the attendee
  const firstName = name.split(' ')[0];
  try {
    await sendTemplate(PADEL.BREVO_TEMPLATE_PADEL_CONFIRM, { email, name: firstName }, {
      firstName,
      playing:     'N/A',
      ticketType:  'Refunded',
      formLink:    `${SITE_URL}/padel`,
      refundPolicy: PADEL.REFUND_POLICY,
      refundPolicyUrl: `${SITE_URL}/padel#refund-policy`,
      eventDate:   'Friday, 11 December 2026',
      venue:       PADEL.VENUE,
      address:     PADEL.ADDRESS,
      loungeEnd:    PADEL.LOUNGE_END,
      rainPlan:    PADEL.RAIN_PLAN,
      refundNote:  `Your R${amount.toFixed(0)} ticket has been refunded. Funds arrive in 3–5 business days.`,
    });
  } catch (e: any) {
    console.error('[padel-refund] Email failed:', e.message);
  }

  // Slack log
  const forceNote = force && !isRefundAllowed() ? ' (admin override — past cutoff)' : '';
  await postWebhook(SLACK_URL, `💸 *Padel refund issued${forceNote}*\n*${name}* (${email}) | R${amount.toFixed(0)}\n*Ref:* ${paymentId}`).catch(() => {});

  return res(200, { ok: true, name, email, amount });
};

function res(status: number, data: object) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
