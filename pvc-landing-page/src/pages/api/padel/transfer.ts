export const prerender = false;

import type { APIRoute } from 'astro';
import crypto from 'crypto';
import { notionQuery, notionPatch, titleProp, emailProp, textProp } from '../../../lib/notion';
import { sendTemplate } from '../../../lib/brevo';
import { postWebhook } from '../../../lib/slack';
import { PADEL, buildPadelIcs } from '../../../lib/padel-config';

const MAGIC_LINK_SECRET = import.meta.env.MAGIC_LINK_SECRET ?? '';
const SITE_URL          = 'https://privatevictoriesclub.com';

function generateFormToken(paymentId: string, email: string): string {
  if (!MAGIC_LINK_SECRET) return '';
  return crypto.createHmac('sha256', MAGIC_LINK_SECRET).update(`${paymentId}:${email}`).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/**
 * POST /api/padel/transfer
 * Body: { token: string, ref: string, newName: string, newEmail: string }
 *
 * The original ticket holder authenticates with their HMAC token, then
 * re-assigns name + email to the new holder, generates a fresh form token,
 * re-sends the confirmation email to the new holder, and logs the transfer.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }

  const { token, ref, newName, newEmail } = body ?? {};

  if (!token || !ref || !newName || !newEmail) return err(400, 'Missing required fields');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return err(400, 'Invalid email address');

  // ── Look up the ticket by payment ref ──
  let rows: any[];
  try {
    rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID, {
      property: 'Payment ID', rich_text: { equals: ref },
    });
  } catch (e: any) {
    console.error('[padel/transfer] Notion query failed:', e.message);
    return err(502, 'Could not look up ticket. Please try again.');
  }

  if (!rows.length) return err(404, 'Ticket not found');

  const row     = rows[0];
  const pageId  = row.id;
  const p       = row.properties;
  const oldEmail = p['Email']?.email ?? '';
  const oldName  = (p['Name']?.title ?? []).map((t: any) => t.plain_text).join('');
  const refunded = p['Refunded']?.checkbox ?? false;

  if (refunded) return err(409, 'This ticket has been refunded and cannot be transferred');

  // ── Verify the HMAC token belongs to the original holder ──
  if (!MAGIC_LINK_SECRET) return err(503, 'Transfer service temporarily unavailable');
  const expected = generateFormToken(ref, oldEmail);
  if (!expected) return err(503, 'Transfer service temporarily unavailable');

  let tokenMatch = false;
  try { tokenMatch = safeEqual(expected, token); } catch { tokenMatch = false; }
  if (!tokenMatch) return err(403, 'Invalid or expired transfer link');

  // ── Prevent self-transfer ──
  if (newEmail.toLowerCase() === oldEmail.toLowerCase()) {
    return err(409, 'New email is the same as the current holder\'s email');
  }

  // ── Generate fresh form token for the new holder ──
  const newFormToken = generateFormToken(ref, newEmail);
  const newFormLink  = `${SITE_URL}/padel-confirm?token=${newFormToken}&ref=${ref}`;

  // ── Build transfer log entry ──
  const existingLog = (p['Transfer Log']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
  const logEntry = `${new Date().toISOString()} | ${oldName} <${oldEmail}> → ${newName} <${newEmail}>`;
  const newLog   = existingLog ? `${existingLog}\n${logEntry}` : logEntry;

  // ── Patch Notion row ──
  try {
    await notionPatch(pageId, {
      'Name':         titleProp(newName),
      'Email':        emailProp(newEmail),
      'Form Token':   textProp(newFormToken),
      'Form Completed': { checkbox: false },
      'Consent':        { checkbox: false },
      'Transfer Log': textProp(newLog),
    });
  } catch (e: any) {
    console.error('[padel/transfer] Notion patch failed:', e.message);
    return err(502, 'Could not update ticket. Please try again.');
  }

  // ── Re-send confirmation to new holder ──
  const firstName  = newName.split(' ')[0] ?? newName;
  const playing    = p['Playing']?.select?.name ?? 'No';
  const ticketType = p['Ticket Type']?.select?.name ?? 'GA';
  const tier       = p['Tier']?.select?.name ?? '';
  const amount     = p['Amount']?.number ?? '';
  const icsBase64  = buildPadelIcs();

  try {
    await sendTemplate(
      PADEL.BREVO_TEMPLATE_PADEL_CONFIRM,
      { email: newEmail, name: firstName },
      {
        firstName,
        playing:      playing === 'Yes' ? "Yes, you're playing" : 'No, social only',
        ticketType:   `${ticketType === 'Member' ? 'PVC Member' : 'General Admission'} · ${tier} · R${amount}`,
        formLink:     newFormLink,
        refundPolicy: PADEL.REFUND_POLICY,
        refundPolicyUrl: `${SITE_URL}/padel#refund-policy`,
        eventDate:    'Friday, 11 December 2026',
        venue:        PADEL.VENUE,
        address:      PADEL.ADDRESS,
        loungeEnd:     PADEL.LOUNGE_END,
        rainPlan:     PADEL.RAIN_PLAN,
      },
      [{ content: icsBase64, name: 'padel-social.ics' }],
    );
  } catch (e: any) {
    console.error('[padel/transfer] Brevo send failed:', e.message);
    // Non-fatal — Notion is already updated, log the warning
  }

  // ── Slack notification ──
  await postWebhook(import.meta.env.SLACK_FINANCE_URL ?? '',
    `🔄 *Padel ticket transferred*\n*From:* ${oldName} (${oldEmail})\n*To:* ${newName} (${newEmail})\n*Ref:* ${ref}`
  ).catch(() => {});

  return new Response(JSON.stringify({ ok: true, message: `Ticket transferred to ${newName}. Confirmation sent to ${newEmail}.` }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
}
