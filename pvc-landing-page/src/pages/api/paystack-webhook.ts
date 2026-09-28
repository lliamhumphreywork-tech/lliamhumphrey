export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import crypto from 'crypto';

const NOTION_TOKEN         = import.meta.env.NOTION_TOKEN;
const NOTION_FINANCE_DB_ID = import.meta.env.NOTION_FINANCE_DB_ID;
const NOTION_CRM_DB_ID     = '872bd20eee31468f91bed1cd472e157a';
const BREVO_API_KEY        = import.meta.env.BREVO_API_KEY;
const SLACK_FINANCE_URL    = import.meta.env.SLACK_FINANCE_URL;
const PAYSTACK_SECRET      = import.meta.env.PAYSTACK_SECRET_KEY;

const TEMPLATE_MEMBERSHIP_ONBOARDING = 28;
const TEMPLATE_EVENT_CONFIRMATION    = 29;
const BREVO_LIST_4MONTH              = 14;
const BREVO_BASE                     = 'https://api.brevo.com/v3';

function verifyPaystackSignature(body: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!signature) return false;
  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
  return hash === signature;
}

async function isAlreadyProcessed(paymentId: string): Promise<boolean> {
  if (!NOTION_FINANCE_DB_ID || !paymentId) return false;
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_FINANCE_DB_ID}/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
    body: JSON.stringify({ filter: { property: 'Payment ID', rich_text: { equals: paymentId } }, page_size: 1 }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return (data.results?.length ?? 0) > 0;
}

async function createFinanceEntry(data: {
  name: string; email: string; amount: string;
  paymentId: string; itemName: string; paymentType: 'Membership' | 'Event' | 'Other';
}) {
  if (!NOTION_FINANCE_DB_ID) return;
  const body = {
    parent: { database_id: NOTION_FINANCE_DB_ID },
    properties: {
      'Entry Name': { title: [{ text: { content: data.name || 'Paystack Payment' } }] },
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
    headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`[paystack-webhook] Notion error ${res.status}: ${await res.text()}`);
}

async function updateCRMPaymentStatus(email: string, paymentType: 'Membership' | 'Event' | 'Other') {
  if (paymentType === 'Other') return;
  if (!email) return;
  const searchRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_CRM_DB_ID}/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
    body: JSON.stringify({ filter: { property: 'Email', email: { equals: email } } }),
  });
  if (!searchRes.ok) return;
  const { results } = await searchRes.json();
  if (!results?.length) return;
  const newStatus = paymentType === 'Membership' ? 'Active Member' : 'Event Attendee';
  await fetch(`https://api.notion.com/v1/pages/${results[0].id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
    body: JSON.stringify({ properties: { Status: { select: { name: newStatus } } } }),
  });
}

async function tag4MonthRenewal(email: string, name: string) {
  if (!BREVO_API_KEY || !email) return;
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + 105);
  const renewalStr = renewalDate.toISOString().split('T')[0];
  await fetch(`${BREVO_BASE}/contacts`, {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      attributes: { FIRSTNAME: name.split(' ')[0], RENEWAL_DUE: renewalStr },
      listIds: [BREVO_LIST_4MONTH],
      updateEnabled: true,
    }),
  });
}

async function sendPaymentConfirmation(email: string, firstName: string, paymentType: 'Membership' | 'Event' | 'Other', itemName: string) {
  if (!BREVO_API_KEY || !email) return;
  if (paymentType === 'Other') return;
  const templateId = paymentType === 'Event' ? TEMPLATE_EVENT_CONFIRMATION : TEMPLATE_MEMBERSHIP_ONBOARDING;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ templateId, to: [{ email, name: firstName }], params: { firstName, itemName } }),
  });
  if (!res.ok) console.error(`[paystack-webhook] Brevo error ${res.status}: ${await res.text()}`);
}

async function notifySlackFinance(data: { name: string; email: string; amount: string; itemName: string; paymentType: string; paymentId: string }) {
  if (!SLACK_FINANCE_URL) return;
  await fetch(SLACK_FINANCE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `<!channel> 💰 *New Payment (Paystack) - R${data.amount}*\n*${data.name}* (${data.email})\n*Type:* ${data.paymentType} | *Item:* ${data.itemName}\n*Ref:* ${data.paymentId}`,
    }),
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body      = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!verifyPaystackSignature(body, signature, PAYSTACK_SECRET)) {
    console.warn('[paystack-webhook] Signature verification failed');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }

  if (payload.event !== 'charge.success') {
    console.log(`[paystack-webhook] Event ${payload.event} - no action`);
    return new Response('OK', { status: 200 });
  }

  const data       = payload.data ?? {};
  const amountRands = (data.amount / 100).toFixed(2);
  const paymentId  = data.reference ?? '';
  const email      = data.customer?.email ?? data.metadata?.email ?? '';
  const name       = data.metadata?.name ?? data.metadata?.custom_fields?.find((f: any) => f.variable_name === 'name')?.value ?? `${data.customer?.first_name ?? ''} ${data.customer?.last_name ?? ''}`.trim();
  const firstName  = name.split(' ')[0] ?? '';
  const itemName   = data.metadata?.item_name ?? data.metadata?.custom_fields?.find((f: any) => f.variable_name === 'item_name')?.value ?? data.plan?.name ?? 'PVC Payment';

  const lower = itemName.toLowerCase();
  const paymentType: 'Membership' | 'Event' | 'Other' =
    lower.includes('membership') ? 'Membership' :
    lower.includes('event') || lower.includes('dinner') || lower.includes('ticket') || lower.includes('admission') ||
    lower.includes('mastermind') || lower.includes('cape town') || lower.includes('summit') || lower.includes('workshop') ? 'Event' :
    'Other';

  console.log(`[paystack-webhook] charge.success - ${name} R${amountRands} | ${paymentType}`);

  if (await isAlreadyProcessed(paymentId)) {
    console.log(`[paystack-webhook] Duplicate - ${paymentId} already processed, skipping`);
    return new Response('OK', { status: 200 });
  }

  const is4Month = itemName.includes('4-Month');

  waitUntil(
    Promise.all([
      createFinanceEntry({ name, email, amount: amountRands, paymentId, itemName, paymentType }),
      updateCRMPaymentStatus(email, paymentType),
      sendPaymentConfirmation(email, firstName, paymentType, itemName),
      notifySlackFinance({ name, email, amount: amountRands, itemName, paymentType, paymentId }),
      ...(is4Month ? [tag4MonthRenewal(email, name)] : []),
    ]).catch((err: any) => console.error('[paystack-webhook] Error:', err.message))
  );

  return new Response('OK', { status: 200 });
};
