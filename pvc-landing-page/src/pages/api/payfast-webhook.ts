export const prerender = false;

import type { APIRoute } from 'astro';
import crypto from 'crypto';

const NOTION_TOKEN          = import.meta.env.NOTION_TOKEN;
const NOTION_FINANCE_DB_ID  = import.meta.env.NOTION_FINANCE_DB_ID;
const NOTION_CRM_DB_ID      = '872bd20eee31468f91bed1cd472e157a';
const BREVO_API_KEY         = import.meta.env.BREVO_API_KEY;
const PAYFAST_PASSPHRASE    = import.meta.env.PAYFAST_PASSPHRASE;
const PAYFAST_MERCHANT_ID   = import.meta.env.PAYFAST_MERCHANT_ID ?? '36812457';
const SLACK_FINANCE_URL     = import.meta.env.SLACK_FINANCE_URL;

// Brevo template for payment confirmation
const TEMPLATE_PAYMENT_CONFIRMATION = 21;

function verifySignature(params: Record<string, string>, passphrase: string | undefined): boolean {
  const sorted = Object.keys(params)
    .filter(k => k !== 'signature')
    .sort()
    .map(k => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&');

  const toHash = passphrase ? `${sorted}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}` : sorted;
  const hash = crypto.createHash('md5').update(toHash).digest('hex');
  return hash === params['signature'];
}

async function createFinanceEntry(data: {
  name: string;
  email: string;
  amount: string;
  paymentId: string;
  itemName: string;
  paymentType: 'Membership' | 'Event' | 'Other';
  status: 'Complete' | 'Failed' | 'Cancelled';
}) {
  if (!NOTION_FINANCE_DB_ID) {
    console.warn('[payfast-webhook] NOTION_FINANCE_DB_ID not set — skipping finance entry');
    return;
  }

  const body = {
    parent: { database_id: NOTION_FINANCE_DB_ID },
    properties: {
      Name:          { title: [{ text: { content: data.name } }] },
      Email:         { email: data.email },
      Amount:        { number: parseFloat(data.amount) },
      'Payment ID':  { rich_text: [{ text: { content: data.paymentId } }] },
      'Item':        { rich_text: [{ text: { content: data.itemName } }] },
      Type:          { select: { name: data.paymentType } },
      Status:        { select: { name: data.status } },
      Date:          { date: { start: new Date().toISOString().split('T')[0] } },
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

  if (!res.ok) {
    const err = await res.text();
    console.error(`[payfast-webhook] Notion finance error ${res.status}: ${err}`);
  }
}

async function updateCRMPaymentStatus(email: string, paymentType: 'Membership' | 'Event') {
  // Find the CRM contact by email
  const searchRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_CRM_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: { property: 'Email', email: { equals: email } },
    }),
  });

  if (!searchRes.ok) return;
  const { results } = await searchRes.json();
  if (!results?.length) return;

  const pageId = results[0].id;
  const newStatus = paymentType === 'Membership' ? 'Active Member' : 'Event Attendee';

  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      properties: {
        Status: { select: { name: newStatus } },
      },
    }),
  });
}

async function notifySlackFinance(data: {
  name: string;
  email: string;
  amount: string;
  itemName: string;
  paymentType: string;
  paymentId: string;
}) {
  if (!SLACK_FINANCE_URL) return;
  await fetch(SLACK_FINANCE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `<!channel> 💰 *New Payment — R${data.amount}*\n*${data.name}* (${data.email})\n*Type:* ${data.paymentType} | *Item:* ${data.itemName}\n*ID:* ${data.paymentId}`,
    }),
  });
}

async function sendPaymentConfirmation(email: string, firstName: string) {
  if (!BREVO_API_KEY) return;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      templateId: TEMPLATE_PAYMENT_CONFIRMATION,
      to: [{ email, name: firstName }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[payfast-webhook] Brevo email error ${res.status}: ${err}`);
  }
}

export const POST: APIRoute = async ({ request }) => {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return new Response('Invalid body', { status: 400 });
  }

  // Parse URL-encoded form data from PayFast
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(body)) {
    params[key] = value;
  }

  // Verify merchant ID
  if (params['merchant_id'] !== PAYFAST_MERCHANT_ID) {
    console.warn('[payfast-webhook] Merchant ID mismatch');
    return new Response('Unauthorized', { status: 401 });
  }

  // Verify signature
  if (!verifySignature(params, PAYFAST_PASSPHRASE)) {
    console.warn('[payfast-webhook] Signature verification failed');
    return new Response('Unauthorized', { status: 401 });
  }

  const paymentStatus = params['payment_status'];
  if (paymentStatus !== 'COMPLETE') {
    console.log(`[payfast-webhook] Payment status: ${paymentStatus} — no action`);
    return new Response('OK', { status: 200 });
  }

  const name      = `${params['name_first'] ?? ''} ${params['name_last'] ?? ''}`.trim();
  const email     = params['email_address'] ?? '';
  const amount    = params['amount_gross'] ?? '0';
  const paymentId = params['pf_payment_id'] ?? '';
  const itemName  = params['item_name'] ?? '';

  // Determine payment type from item name
  const lowerItem = itemName.toLowerCase();
  const paymentType: 'Membership' | 'Event' | 'Other' =
    lowerItem.includes('membership') || lowerItem.includes('member') ? 'Membership' :
    lowerItem.includes('event') || lowerItem.includes('dinner') || lowerItem.includes('ticket') ? 'Event' :
    'Other';

  const firstName = params['name_first'] ?? name.split(' ')[0] ?? '';

  console.log(`[payfast-webhook] Payment complete — ${name} (${email}) R${amount} | ${paymentType}`);

  // Run all side effects in parallel, don't block the 200 response
  Promise.all([
    createFinanceEntry({ name, email, amount, paymentId, itemName, paymentType, status: 'Complete' }),
    updateCRMPaymentStatus(email, paymentType),
    sendPaymentConfirmation(email, firstName),
    notifySlackFinance({ name, email, amount, itemName, paymentType, paymentId }),
  ]).catch((err: any) => {
    console.error('[payfast-webhook] Background error:', err.message);
  });

  return new Response('OK', { status: 200 });
};
