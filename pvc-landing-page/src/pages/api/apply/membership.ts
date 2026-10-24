export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';

const NOTION_TOKEN      = import.meta.env.NOTION_TOKEN;
const NOTION_DB_ID      = '872bd20eee31468f91bed1cd472e157a';
const BREVO_API_KEY     = import.meta.env.BREVO_API_KEY;
const SLACK_LEADS_URL   = import.meta.env.SLACK_LEADS_URL;

const BREVO_LIST_ALL      = 10;
const BREVO_LIST_NURTURE  = 11;
const BREVO_LIST_FOUNDING = 12;

const TEMPLATE_CONFIRMATION = 19;
const TEMPLATE_NURTURE      = 20;

const REVENUE_META: Record<string, { list: number; tag: string; notion: string }> = {
  'R0 – R20k/month':      { list: BREVO_LIST_NURTURE,  tag: 'PVC - Pre-Revenue (Nurture)',   notion: 'R0-R20k'      },
  'R20k – R50k/month':    { list: BREVO_LIST_FOUNDING, tag: 'PVC - Founding Tier Prospect',  notion: 'R20k-R50k'    },
  'R50k – R100k/month':   { list: BREVO_LIST_FOUNDING, tag: 'PVC - Founding Tier Prospect',  notion: 'R50k-R100k'   },
  'R100k – R250k/month':  { list: BREVO_LIST_FOUNDING, tag: 'PVC - Inner Circle Prospect',   notion: 'R100k-R250k'  },
  'R250k – R500k/month':  { list: BREVO_LIST_FOUNDING, tag: 'PVC - Inner Circle Prospect',   notion: 'R250k-R500k'  },
  'R500k+/month':         { list: BREVO_LIST_FOUNDING, tag: 'PVC - Top Tier Prospect',       notion: 'R500k+'       },
};

const COMMITMENT_MAP: Record<string, string> = {
  "Yes, I'm ready if it's a fit":            "Ready if it's a fit",
  "Yes, if the fit is undeniable":           "Maybe - depends on the conversation",
  "Not right now, I'm still exploring":      "Not right now",
};

async function isDuplicate(email: string): Promise<boolean> {
  if (!NOTION_TOKEN) return false;
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: { property: 'Email', email: { equals: email } },
      page_size: 1,
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return (data.results?.length ?? 0) > 0;
}

async function createNotionEntry(data: {
  name: string; email: string; phone: string; instagram: string;
  business: string; revenue: string; prompt: string; commitment: string;
  tag: string; notion_revenue: string; source: string;
  tangible_result: string; contribute_gain: string; working_on: string;
  business_needs: string; winning_looks_like: string;
}) {
  const notionCommitment = COMMITMENT_MAP[data.commitment] ?? data.commitment;
  const isPreRevenue = data.revenue === 'R0 – R20k/month';

  const body = {
    parent: { database_id: NOTION_DB_ID },
    properties: {
      Name:              { title: [{ text: { content: data.name } }] },
      Email:             { email: data.email },
      Phone:             { phone_number: data.phone || null },
      IG:                { rich_text: [{ text: { content: data.instagram } }] },
      Business:          { rich_text: [{ text: { content: data.business } }] },
      Revenue:           data.notion_revenue ? { select: { name: data.notion_revenue } } : { select: null },
      Goals:             { rich_text: [{ text: { content: data.prompt } }] },
      Commitment:        notionCommitment ? { select: { name: notionCommitment } } : { select: null },
      'Submission Date': { date: { start: new Date().toISOString().split('T')[0] } },
      Status:            { select: { name: isPreRevenue ? 'Free Community Funnel' : 'Pending Review' } },
      Type:              { multi_select: [{ name: 'Membership Applicant' }] },
      Notes:             { rich_text: [{ text: { content: [
        `Tag: ${data.tag}${data.source ? ' | Source: ' + data.source : ''}`,
        data.tangible_result    ? `\n3-month result: ${data.tangible_result}`    : '',
        data.contribute_gain    ? `\nContribute/gain: ${data.contribute_gain}`   : '',
        data.working_on         ? `\nWorking on: ${data.working_on}`             : '',
        data.business_needs     ? `\nNeeds: ${data.business_needs}`              : '',
        data.winning_looks_like ? `\n12-month win: ${data.winning_looks_like}`   : '',
      ].join('').slice(0, 2000) } }] },
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
    throw new Error(`Notion error ${res.status}: ${err}`);
  }
}

async function addToBrevo(data: {
  firstName: string; lastName: string; email: string; phone: string;
  listIds: number[]; tag: string;
}) {
  if (!BREVO_API_KEY) return;
  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      email: data.email,
      attributes: { FIRSTNAME: data.firstName, LASTNAME: data.lastName, SMS: data.phone || undefined, PVC_TAG: data.tag },
      listIds: data.listIds,
      updateEnabled: true,
    }),
  });
  if (!res.ok && res.status !== 204) {
    console.error(`[apply/membership] Brevo error ${res.status}: ${await res.text()}`);
  }
}

async function sendBrevoTemplate(email: string, firstName: string, templateId: number) {
  if (!BREVO_API_KEY) return;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ templateId, to: [{ email, name: firstName }] }),
  });
  if (!res.ok) console.error(`[apply/membership] Brevo email error ${res.status}: ${await res.text()}`);
}

async function notifySlack(data: { name: string; email: string; business: string; revenue: string; tag: string; source: string }) {
  if (!SLACK_LEADS_URL) return;
  const dot = (data.revenue === 'R500k+/month' || data.revenue === 'R250k – R500k/month') ? ':large_green_circle:' : data.revenue === 'R0 – R20k/month' ? ':white_circle:' : ':large_yellow_circle:';
  await fetch(SLACK_LEADS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `<!channel> ${dot} *New Application · ${data.tag}*\n*${data.name}* — ${data.email}\n*Revenue:* ${data.revenue}\n*Business:* ${data.business}${data.source ? `\n*Source:* ${data.source}` : ''}`,
    }),
  });
}

export const POST: APIRoute = async ({ request }) => {
  // Rate limit: 5 submissions per IP per 15 min
  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const {
    name, email, phone, instagram, business, revenue, prompt, commitment,
    tangible_result, contribute_gain, working_on, business_needs, winning_looks_like,
    utm_source, utm_medium, utm_campaign, referrer,
  } = body;

  if (!name?.trim() || !email?.trim() || !revenue || !prompt?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Dedup
  if (await isDuplicate(email.trim().toLowerCase())) {
    console.log(`[apply/membership] Duplicate application for ${email}`);
    // Return success — don't tell applicant they already applied
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0] ?? '';
  const lastName  = nameParts.slice(1).join(' ');

  const meta        = REVENUE_META[revenue];
  const listIds     = meta ? [BREVO_LIST_ALL, meta.list] : [BREVO_LIST_ALL];
  const tag         = meta?.tag ?? 'PVC - Applicant';
  const notion_revenue = meta?.notion ?? '';
  const isPreRevenue  = revenue === 'R0 – R20k/month';

  const sourceParts = [utm_source, utm_medium, utm_campaign].filter(Boolean);
  const source = sourceParts.length ? sourceParts.join('/') + (referrer && referrer !== 'direct' ? ` (ref: ${referrer})` : '') : referrer || '';

  console.log(`[apply/membership] New application: ${name} (${email}) — ${revenue} | ${tag}`);

  waitUntil(
    Promise.all([
      createNotionEntry({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone ?? '', instagram: instagram ?? '', business: business ?? '', revenue, prompt: prompt.trim(), commitment: commitment ?? '', tag, notion_revenue, source, tangible_result: tangible_result ?? '', contribute_gain: contribute_gain ?? '', working_on: working_on ?? '', business_needs: business_needs ?? '', winning_looks_like: winning_looks_like ?? '' }),
      addToBrevo({ firstName, lastName, email: email.trim().toLowerCase(), phone: phone ?? '', listIds, tag }),
      sendBrevoTemplate(email, firstName, TEMPLATE_CONFIRMATION),
      ...(isPreRevenue ? [sendBrevoTemplate(email, firstName, TEMPLATE_NURTURE)] : []),
      notifySlack({ name: name.trim(), email: email.trim().toLowerCase(), business: business ?? '', revenue, tag, source }),
    ]).then(() => {
      console.log(`[apply/membership] Processed ${name} — ${revenue} | ${tag}`);
    }).catch((err: any) => {
      console.error('[apply/membership] Background error:', err.message);
    })
  );

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
