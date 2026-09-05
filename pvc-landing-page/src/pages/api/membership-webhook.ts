export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';

const NOTION_TOKEN        = import.meta.env.NOTION_TOKEN;
const NOTION_DB_ID        = '872bd20eee31468f91bed1cd472e157a';
const BREVO_API_KEY       = import.meta.env.BREVO_API_KEY;
const TALLY_WEBHOOK_SECRET = import.meta.env.TALLY_MEMBERSHIP_SECRET;
const SLACK_MEMBERS_URL   = import.meta.env.SLACK_MEMBERS_URL;
const SLACK_LEADS_URL     = import.meta.env.SLACK_LEADS_URL;

// Brevo lists
const BREVO_LIST_ALL      = 10; // PVC - Membership Applications (All)
const BREVO_LIST_NURTURE  = 11; // PVC - Pre-Revenue Nurture
const BREVO_LIST_FOUNDING = 12; // PVC - Founding Tier Prospects

// Brevo template IDs
const TEMPLATE_CONFIRMATION = 19;
const TEMPLATE_NURTURE      = 20;

// Revenue → Brevo list + Notion tag
const REVENUE_META: Record<string, { list: number; tag: string }> = {
  'R0 - R10k/month':    { list: BREVO_LIST_NURTURE,  tag: 'PVC - Pre-Revenue (Nurture)' },
  'R10k - R50k/month':  { list: BREVO_LIST_FOUNDING, tag: 'PVC - Founding Tier Prospect' },
  'R50k - R100k/month': { list: BREVO_LIST_FOUNDING, tag: 'PVC - Founding Tier Prospect' },
  'R100k+/month':       { list: BREVO_LIST_FOUNDING, tag: 'PVC - Inner Circle Prospect' },
};

const REVENUE_TO_NOTION: Record<string, string> = {
  'R0 - R10k/month':    'R0-R10k',
  'R10k - R50k/month':  'R10k-R50k',
  'R50k - R100k/month': 'R50k-R100k',
  'R100k+/month':       'R100k+',
};

const COMMITMENT_MAP: Record<string, string> = {
  'Yes, I\'m ready if it\'s a fit':                        'Ready if it\'s a fit',
  'Maybe, depends on the conversation':                     'Maybe - depends on the conversation',
  'Not right now, just want to stay close to what you\'re building': 'Not right now',
};

const FIELD = {
  name:        'Full Name',
  email:       'Email',
  phone:       'Phone number (WhatsApp)',
  instagram:   'Instagram handle',
  business:    'What business are you building?',
  revenue:     'What revenue stage are you at?',
  prompt:      'What prompted you to apply to Private Victories right now?',
  commitment:  'If we decide it\'s a fit, are you ready to commit at that level?',
  utm_source:  'utm_source',
  utm_medium:  'utm_medium',
  utm_campaign:'utm_campaign',
  referrer:    'referrer',
};

function extractField(fields: any[], label: string): string {
  const field = fields.find((f: any) => f.label === label);
  if (!field) return '';
  if (Array.isArray(field.value)) {
    const options: any[] = field.options ?? [];
    return field.value.map((v: any) => {
      if (v && typeof v === 'object') return v.text ?? v;
      const match = options.find((o: any) => o.id === v);
      return match?.text ?? v;
    }).join(', ');
  }
  return String(field.value ?? '');
}

async function addToBrevo(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  listIds: number[];
  tag: string;
}) {
  if (!BREVO_API_KEY) return;

  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      email: data.email,
      attributes: {
        FIRSTNAME: data.firstName,
        LASTNAME:  data.lastName,
        SMS:       data.phone || undefined,
        PVC_TAG:   data.tag,
      },
      listIds: data.listIds,
      updateEnabled: true,
    }),
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    console.error(`[membership-webhook] Brevo upsert error ${res.status}: ${err}`);
  }
}

async function sendBrevoTemplate(email: string, firstName: string, templateId: number) {
  if (!BREVO_API_KEY) return;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      templateId,
      to: [{ email, name: firstName }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[membership-webhook] Brevo email error ${res.status}: ${err}`);
  }
}

async function notifySlackMembers(data: {
  name: string;
  email: string;
  business: string;
  revenue: string;
  tag: string;
  source: string;
}) {
  if (!SLACK_MEMBERS_URL) return;
  await fetch(SLACK_MEMBERS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🙋 *New Application*\n*${data.name}* (${data.email})\n*Business:* ${data.business}\n*Revenue:* ${data.revenue}\n*Tag:* ${data.tag}${data.source ? `\n*Source:* ${data.source}` : ''}`,
    }),
  });
}

async function notifySlackLeads(data: {
  name: string; email: string; business: string; revenue: string; tag: string;
}) {
  if (!SLACK_LEADS_URL) return;
  const dot = data.revenue === 'R100k+/month' ? ':large_green_circle:' : data.revenue === 'R0 - R10k/month' ? ':white_circle:' : ':large_yellow_circle:';
  await fetch(SLACK_LEADS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `<!channel> ${dot} *New Membership Lead · ${data.tag}*\n*${data.name}* — ${data.email}\n*Revenue:* ${data.revenue}\n*Business:* ${data.business}`,
    }),
  });
}

async function createNotionEntry(data: {
  name: string;
  email: string;
  phone: string;
  instagram: string;
  business: string;
  revenue: string;
  prompt: string;
  commitment: string;
  tag: string;
  source: string;
}) {
  const notionRevenue = REVENUE_TO_NOTION[data.revenue];
  const notionCommitment = COMMITMENT_MAP[data.commitment] ?? data.commitment;
  const isPreRevenue = data.revenue === 'R0 - R10k/month';

  const body = {
    parent: { database_id: NOTION_DB_ID },
    properties: {
      Name:             { title: [{ text: { content: data.name } }] },
      Email:            { email: data.email },
      Phone:            { phone_number: data.phone || null },
      IG:               { rich_text: [{ text: { content: data.instagram } }] },
      Business:         { rich_text: [{ text: { content: data.business } }] },
      Revenue:          notionRevenue ? { select: { name: notionRevenue } } : { select: null },
      Goals:            { rich_text: [{ text: { content: data.prompt } }] },
      Commitment:       notionCommitment ? { select: { name: notionCommitment } } : { select: null },
      'Submission Date':{ date: { start: new Date().toISOString().split('T')[0] } },
      Status:           { select: { name: isPreRevenue ? 'Free Community Funnel' : 'Pending Review' } },
      Type:             { multi_select: [{ name: 'Membership Applicant' }] },
      Notes:            { rich_text: [{ text: { content: `Tag: ${data.tag}${data.source ? ' | Source: ' + data.source : ''}` } }] },
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
    throw new Error(`Notion API error ${res.status}: ${err}`);
  }
  return res.json();
}

export const POST: APIRoute = async ({ request }) => {
  if (!NOTION_TOKEN) {
    return new Response('NOTION_TOKEN not set', { status: 500 });
  }

  if (TALLY_WEBHOOK_SECRET) {
    const sig = request.headers.get('tally-webhook-secret');
    if (sig !== TALLY_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (payload.eventType !== 'FORM_RESPONSE') {
    return new Response('OK', { status: 200 });
  }

  const fields: any[] = payload.data?.fields ?? [];
  const name        = extractField(fields, FIELD.name);
  const email       = extractField(fields, FIELD.email);
  const phone       = extractField(fields, FIELD.phone);
  const instagram   = extractField(fields, FIELD.instagram);
  const business    = extractField(fields, FIELD.business);
  const revenue     = extractField(fields, FIELD.revenue);
  const prompt      = extractField(fields, FIELD.prompt);
  const commitment  = extractField(fields, FIELD.commitment);
  const utmSource   = extractField(fields, FIELD.utm_source);
  const utmMedium   = extractField(fields, FIELD.utm_medium);
  const utmCampaign = extractField(fields, FIELD.utm_campaign);
  const referrer    = extractField(fields, FIELD.referrer);
  const sourceParts = [utmSource, utmMedium, utmCampaign].filter(Boolean);
  const source      = sourceParts.length
    ? sourceParts.join('/') + (referrer && referrer !== 'direct' ? ` (ref: ${referrer})` : '')
    : referrer || '';

  if (!name || !email) {
    return new Response('Missing required fields', { status: 400 });
  }

  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0] ?? '';
  const lastName  = nameParts.slice(1).join(' ');

  const meta = REVENUE_META[revenue];
  const listIds = meta ? [BREVO_LIST_ALL, meta.list] : [BREVO_LIST_ALL];
  const tag     = meta?.tag ?? 'PVC - Applicant';
  const isPreRevenue = revenue === 'R0 - R10k/month';

  // Return 200 immediately — Tally has a 10s timeout
  waitUntil(
    Promise.all([
      createNotionEntry({ name, email, phone, instagram, business, revenue, prompt, commitment, tag, source }),
      addToBrevo({ firstName, lastName, email, phone, listIds, tag }),
      sendBrevoTemplate(email, firstName, TEMPLATE_CONFIRMATION),
      ...(isPreRevenue ? [sendBrevoTemplate(email, firstName, TEMPLATE_NURTURE)] : []),
      notifySlackLeads({ name, email, business, revenue, tag }),
    ]).then(() => {
      console.log(`[membership-webhook] Processed ${name} (${email}) — ${revenue} | ${tag}`);
    }).catch((err: any) => {
      console.error('[membership-webhook] Background error:', err.message);
    })
  );

  return new Response('OK', { status: 200 });
};
