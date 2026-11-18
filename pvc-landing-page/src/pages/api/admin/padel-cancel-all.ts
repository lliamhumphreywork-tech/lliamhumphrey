export const prerender = false;

import type { APIRoute } from 'astro';
import { notionQuery, notionPatch, checkProp } from '../../../lib/notion';
import { sendTemplate } from '../../../lib/brevo';
import { postWebhook } from '../../../lib/slack';
import { PADEL } from '../../../lib/padel-config';

const ADMIN_KEY       = import.meta.env.ADMIN_KEY ?? '';
const PAYSTACK_SECRET = import.meta.env.PAYSTACK_SECRET_KEY ?? '';
const SLACK_URL       = import.meta.env.SLACK_FINANCE_URL ?? '';
const SITE_URL        = 'https://privatevictoriesclub.com';
const CONFIRM_PHRASE  = 'CANCEL EVENT';

function auth(request: Request): boolean {
  return (request.headers.get('x-admin-key') ?? '') === ADMIN_KEY && ADMIN_KEY !== '';
}

export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) return res(401, { error: 'Unauthorized' });

  let body: any;
  try { body = await request.json(); } catch { return res(400, { error: 'Invalid JSON' }); }

  if (body?.confirm !== CONFIRM_PHRASE) {
    return res(400, { error: `Send { "confirm": "${CONFIRM_PHRASE}" } to proceed.` });
  }

  let rows: any[] = [];
  try { rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID); } catch (e: any) {
    return res(502, { error: `Notion error: ${e.message}` });
  }

  const targets = rows.filter((r: any) => !r.properties['Refunded']?.checkbox);
  let refunded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of targets) {
    const p         = row.properties;
    const email     = p['Email']?.email ?? '';
    const name      = (p['Name']?.title ?? []).map((t: any) => t.plain_text).join('');
    const paymentId = (p['Payment ID']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
    const amount    = p['Amount']?.number ?? 0;
    const firstName = name.split(' ')[0];

    if (!paymentId) { failed++; errors.push(`${email}: no payment ID`); continue; }

    // Paystack refund
    try {
      const psRes = await fetch('https://api.paystack.co/refund', {
        method: 'POST',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: paymentId }),
      });
      if (!psRes.ok) {
        const txt = await psRes.text();
        errors.push(`${email}: Paystack ${psRes.status} ${txt.slice(0, 100)}`);
        failed++;
        continue;
      }
    } catch (e: any) {
      errors.push(`${email}: ${e.message}`);
      failed++;
      continue;
    }

    // Mark refunded in Notion
    try { await notionPatch(row.id, { 'Refunded': checkProp(true) }); } catch { /* non-fatal */ }

    // Email attendee
    try {
      await sendTemplate(PADEL.BREVO_TEMPLATE_PADEL_CONFIRM, { email, name: firstName }, {
        firstName,
        playing:     'N/A',
        ticketType:  'Cancelled — Full Refund',
        formLink:    `${SITE_URL}/padel`,
        refundPolicy: PADEL.REFUND_POLICY,
        refundPolicyUrl: `${SITE_URL}/padel#refund-policy`,
        eventDate:   'Friday, 11 December 2026',
        venue:       PADEL.VENUE,
        address:     PADEL.ADDRESS,
        loungeEnd:    PADEL.LOUNGE_END,
        rainPlan:    PADEL.RAIN_PLAN,
        refundNote:  `We have cancelled the Padel Social. Your R${amount.toFixed(0)} ticket has been fully refunded. Funds arrive in 3–5 business days. We're sorry for the inconvenience.`,
      });
    } catch (e: any) {
      console.error('[padel-cancel-all] Email to', email, 'failed:', e.message);
    }

    refunded++;
  }

  const summary = `🚫 *PADEL EVENT CANCELLED*\n*Refunded:* ${refunded}/${targets.length} tickets\n*Failed:* ${failed}${errors.length ? '\n*Errors:* ' + errors.slice(0, 5).join('; ') : ''}`;
  await postWebhook(SLACK_URL, summary).catch(() => {});

  return res(200, { ok: true, refunded, failed, total: targets.length, errors });
};

function res(status: number, data: object) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
