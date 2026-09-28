export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import crypto from 'crypto';

const NOTION_TOKEN         = import.meta.env.NOTION_TOKEN;
const NOTION_FINANCE_DB_ID = import.meta.env.NOTION_FINANCE_DB_ID;
const NOTION_CRM_DB_ID     = '872bd20eee31468f91bed1cd472e157a';
const BREVO_API_KEY        = import.meta.env.BREVO_API_KEY;
const SLACK_FINANCE_URL    = import.meta.env.SLACK_FINANCE_URL;
const YOCO_SECRET          = import.meta.env.YOCO_WEBHOOK_SECRET;

const TEMPLATE_MEMBERSHIP_ONBOARDING = 28;
const TEMPLATE_EVENT_CONFIRMATION    = 29;

function verifyYocoSignature(
  body: string,
  signature: string | null,
  webhookId: string | null,
  webhookTimestamp: string | null,
  secret: string | undefined
): 'ok' | 'skip' | 'fail' {
  if (!secret) return 'skip';
  if (!signature || !webhookId || !webhookTimestamp) {
    console.warn('[yoco-webhook] Missing signature headers — sig:', signature, 'id:', webhookId, 'ts:', webhookTimestamp);
    return 'skip';
  }
  try {
    const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64');
    const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;
    const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    // header is "v1,<base64>" — possibly multiple space-separated signatures
    const match = signature.split(' ').some(part => {
      const val = part.includes(',') ? part.split(',')[1] : part;
      return val === expected;
    });
    if (!match) console.warn('[yoco-webhook] Sig mismatch — expected:', expected, 'header:', signature);
    return match ? 'ok' : 'fail';
  } catch (e: any) {
    console.error('[yoco-webhook] Sig error:', e.message);
    return 'fail';
  }
}

async function isAlreadyProcessed(paymentId: string): Promise<boolean> {
  if (!NOTION_FINANCE_DB_ID || !paymentId) return false;
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_FINANCE_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: { property: 'Payment ID', rich_text: { equals: paymentId } },
      page_size: 1,
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return (data.results?.length ?? 0) > 0;
}

async function createFinanceEntry(data: {
  name: string;
  email: string;
  amount: string;
  paymentId: string;
  itemName: string;
  paymentType: 'Membership' | 'Event' | 'Other';
}) {
  if (!NOTION_FINANCE_DB_ID) return;

  const body = {
    parent: { database_id: NOTION_FINANCE_DB_ID },
    properties: {
      'Entry Name': { title: [{ text: { content: data.name || 'Yoco Payment' } }] },
      Email:        { email: data.email || null },
      Amount:       { number: parseFloat(data.amount) },
      'Payment ID': { rich_text: [{ text: { content: data.paymentId } }] },
      Item:         { rich_text: [{ text: { content: data.itemName } }] },
      Category:     { select: { name: data.paymentType } },
      Status:       { select: { name: 'Complete' } },
      Date:         { date: { start: new Date().toISOString().split('T')[0] } },
    },
  };

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) console.error(`[yoco-webhook] Notion error ${res.status}: ${await res.text()}`);
}

async function updateCRMPaymentStatus(email: string, paymentType: 'Membership' | 'Event') {
  if (!email) return;
  const searchRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_CRM_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ filter: { property: 'Email', email: { equals: email } } }),
  });

  if (!searchRes.ok) return;
  const { results } = await searchRes.json();
  if (!results?.length) return;

  const newStatus = paymentType === 'Membership' ? 'Active Member' : 'Event Attendee';
  await fetch(`https://api.notion.com/v1/pages/${results[0].id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ properties: { Status: { select: { name: newStatus } } } }),
  });
}

async function sendPaymentConfirmation(email: string, firstName: string, paymentType: 'Membership' | 'Event' | 'Other', itemName: string) {
  if (!BREVO_API_KEY || !email) return;
  const templateId = paymentType === 'Event' ? TEMPLATE_EVENT_CONFIRMATION : TEMPLATE_MEMBERSHIP_ONBOARDING;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ templateId, to: [{ email, name: firstName }], params: { firstName, itemName } }),
  });
  if (!res.ok) console.error(`[yoco-webhook] Brevo error ${res.status}: ${await res.text()}`);
}

async function notifySlackFinance(data: { name: string; email: string; amount: string; itemName: string; paymentType: string; paymentId: string }) {
  if (!SLACK_FINANCE_URL) return;
  await fetch(SLACK_FINANCE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `<!channel> 💰 *New Payment (Yoco) — R${data.amount}*\n*${data.name}* (${data.email})\n*Type:* ${data.paymentType} | *Item:* ${data.itemName}\n*ID:* ${data.paymentId}`,
    }),
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const signature    = request.headers.get('webhook-signature');
  const webhookId    = request.headers.get('webhook-id');
  const webhookTs    = request.headers.get('webhook-timestamp');

  console.log('[yoco-webhook] Headers — sig:', signature?.slice(0,30), 'id:', webhookId, 'ts:', webhookTs);

  const sigResult = verifyYocoSignature(body, signature, webhookId, webhookTs, YOCO_SECRET);
  if (sigResult !== 'ok') {
    console.warn('[yoco-webhook] Rejecting request — sig result:', sigResult);
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const eventType = payload.type ?? '';
  if (!eventType.includes('payment.succeeded') && !eventType.includes('checkout.completed')) {
    console.log(`[yoco-webhook] Event ${eventType} — no action`);
    return new Response('OK', { status: 200 });
  }

  const data = payload.payload ?? payload;
  const amountCents: number = data.amountInCents ?? data.amount ?? 0;
  const amountRands = (amountCents / 100).toFixed(2);
  const paymentId   = data.id ?? data.checkoutId ?? '';
  const metadata    = data.metadata ?? {};
  const itemName    = metadata.item_name ?? data.checkoutId ?? 'PVC Payment';
  const email       = metadata.email ?? '';
  const name        = metadata.name ?? '';
  const firstName   = name.split(' ')[0] ?? '';

  const lower = itemName.toLowerCase();
  const paymentType: 'Membership' | 'Event' | 'Other' =
    lower.includes('membership') || lower.includes('member') ? 'Membership' :
    lower.includes('event') || lower.includes('dinner') || lower.includes('ticket') ? 'Event' :
    'Other';

  console.log(`[yoco-webhook] ${eventType} — ${name} R${amountRands} | ${paymentType}`);

  if (await isAlreadyProcessed(paymentId)) {
    console.log(`[yoco-webhook] Duplicate — ${paymentId} already processed, skipping`);
    return new Response('OK', { status: 200 });
  }

  waitUntil(
    Promise.all([
      createFinanceEntry({ name, email, amount: amountRands, paymentId, itemName, paymentType }),
      updateCRMPaymentStatus(email, paymentType),
      sendPaymentConfirmation(email, firstName, paymentType, itemName),
      notifySlackFinance({ name, email, amount: amountRands, itemName, paymentType, paymentId }),
    ]).catch((err: any) => console.error('[yoco-webhook] Error:', err.message))
  );

  return new Response('OK', { status: 200 });
};
