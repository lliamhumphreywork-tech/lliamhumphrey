export const prerender = false;

import type { APIRoute } from 'astro';
import crypto from 'crypto';
import { notionQuery, notionPatch, titleProp, emailProp, textProp } from '../../../lib/notion';
import { sendTemplate } from '../../../lib/brevo';
import { postWebhook } from '../../../lib/slack';
import { PADEL, buildPadelIcs } from '../../../lib/padel-config';

const ADMIN_KEY         = import.meta.env.ADMIN_KEY ?? '';
const MAGIC_LINK_SECRET = import.meta.env.MAGIC_LINK_SECRET ?? '';
const SITE_URL          = 'https://privatevictoriesclub.com';

function auth(request: Request): boolean {
  return (request.headers.get('x-admin-key') ?? '') === ADMIN_KEY && ADMIN_KEY !== '';
}

function generateFormToken(paymentId: string, email: string): string {
  if (!MAGIC_LINK_SECRET) return '';
  return crypto.createHmac('sha256', MAGIC_LINK_SECRET).update(`${paymentId}:${email}`).digest('hex');
}

/**
 * POST /api/admin/padel-transfer
 * Body: { pageId: string, newName: string, newEmail: string }
 * Admin-key protected. No HMAC check — admin override.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }

  const { pageId, newName, newEmail } = body ?? {};
  if (!pageId || !newName || !newEmail) return err(400, 'Missing pageId, newName, or newEmail');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return err(400, 'Invalid email address');

  // ── Fetch current row ──
  let row: any;
  try {
    const rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID, {
      property: 'ID', unique_id: { equals: pageId },
    });
    // Fall back: query by page id if unique_id filter isn't available
    row = rows.find((r: any) => r.id === pageId) ?? rows[0];
  } catch { row = null; }

  // If the filter approach didn't work, try fetching by id directly via notionPatch
  // We'll proceed using what we can derive from the patch

  const p         = row?.properties ?? {};
  const oldEmail  = p['Email']?.email ?? '';
  const oldName   = (p['Name']?.title ?? []).map((t: any) => t.plain_text).join('');
  const paymentId = (p['Payment ID']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
  const refunded  = p['Refunded']?.checkbox ?? false;

  if (refunded) return err(409, 'This ticket has been refunded and cannot be transferred');

  // ── Generate fresh form token ──
  const newFormToken = paymentId ? generateFormToken(paymentId, newEmail) : '';
  const newFormLink  = newFormToken ? `${SITE_URL}/padel-confirm?token=${newFormToken}&ref=${paymentId}` : '';

  // ── Build transfer log ──
  const existingLog = (p['Transfer Log']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
  const logEntry    = `${new Date().toISOString()} | ADMIN | ${oldName || '?'} <${oldEmail || '?'}> → ${newName} <${newEmail}>`;
  const newLog      = existingLog ? `${existingLog}\n${logEntry}` : logEntry;

  // ── Patch Notion ──
  const patch: Record<string, any> = {
    'Name':           titleProp(newName),
    'Email':          emailProp(newEmail),
    'Form Completed': { checkbox: false },
    'Consent':        { checkbox: false },
    'Transfer Log':   textProp(newLog),
  };
  if (newFormToken) patch['Form Token'] = textProp(newFormToken);

  try {
    await notionPatch(pageId, patch);
  } catch (e: any) {
    return err(502, `Notion patch failed: ${e.message}`);
  }

  // ── Re-send confirmation to new holder ──
  if (newFormLink && paymentId) {
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
      console.error('[admin/padel-transfer] Brevo send failed:', e.message);
    }
  }

  await postWebhook(import.meta.env.SLACK_FINANCE_URL ?? '',
    `🔄 *Padel ticket transferred (admin)*\n*From:* ${oldName || '?'} (${oldEmail || '?'})\n*To:* ${newName} (${newEmail})\n*Ref:* ${paymentId || pageId}`
  ).catch(() => {});

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
}
