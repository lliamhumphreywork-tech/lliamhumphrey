export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';

const NOTION_TOKEN         = import.meta.env.NOTION_TOKEN;
const NOTION_CRM_DB_ID     = '872bd20eee31468f91bed1cd472e157a';
const TALLY_WEBHOOK_SECRET = import.meta.env.TALLY_WEBHOOK_SECRET;
const BREVO_API_KEY        = import.meta.env.BREVO_API_KEY;

const BREVO_LIST_EVENTS = 6;
const TEMPLATE_CT_MASTERMIND_APPLICATION = 30;

const FIELD = {
  name:       'Full Name',
  email:      'Email Address',
  phone:      'Phone Number',
  insta:      'Your Instagram Handle',
  biz:        'What business are you currently building?',
  stage:      'What stage are you currently at?',
  bottleneck: 'What is the single biggest bottleneck in your business right now?',
  why:        'Why do you want to attend this event',
  ticket:     'Ticket type',
  heard:      'How did you hear about PVC?',
};

const SLACK_LEADS_URL = import.meta.env.SLACK_LEADS_URL;

const STAGE_SCORES: Record<string, number> = {
  'R0 - R10,000':        0,
  'R10,000 - R50,000':   5,
  'R50,000 - R100,000':  10,
  'R100,000 - R500,000': 15,
  'R500,000+':           20,
};

const TICKET_SCORES: Record<string, number> = {
  'General Admission - R2,500':       0,
  'General Admission':                0,
  'VIP - R3,750 (3 seats only)':      5,
  'VIP Admission':                    5,
};

const WHY_HIGH = ['scale', 'scaling', 'revenue', 'clients', 'sales', 'network', 'partnerships', 'accountability', 'mastermind', 'next level', 'grow my business'];
const WHY_MID  = ['learn', 'connect', 'inspiration', 'opportunity', 'meet'];

function scoreWhy(why: string): number {
  const lower = why.toLowerCase();
  if (WHY_HIGH.some(k => lower.includes(k))) return 5;
  if (WHY_MID.some(k => lower.includes(k))) return 2;
  return 0;
}

function calcScore(stage: string, ticket: string, why: string): number {
  return (STAGE_SCORES[stage] ?? 0) + (TICKET_SCORES[ticket] ?? 0) + scoreWhy(why);
}

function scorePriority(score: number): string {
  if (score >= 20) return 'Hot';
  if (score >= 10) return 'Warm';
  return 'Cold';
}

const STAGE_LABEL: Record<string, string> = {
  'R0 - R10,000':       'R0-R10k',
  'R10,000 - R50,000':  'R10k-R50k',
  'R50,000 - R100,000': 'R50k-R100k',
  'R100,000 - R500,000':'R100k-R500k',
  'R500,000+':          'R500k+',
};

function extractField(fields: any[], label: string): string {
  const field = fields.find((f: any) => f.label === label);
  if (!field) return '';
  if (Array.isArray(field.value)) {
    const options: any[] = field.options ?? [];
    return field.value.map((v: any) => {
      if (typeof v === 'string' && options.length) {
        const match = options.find((o: any) => o.id === v);
        return match?.text ?? v;
      }
      return v.text ?? v;
    }).join(', ');
  }
  return String(field.value ?? '');
}

async function postLeadToSlack(data: {
  name: string; email: string; stage: string; ticket: string; biz: string;
}, score: number, priority: string) {
  if (!SLACK_LEADS_URL) {
    console.error('[ct-mastermind-webhook] SLACK_LEADS_URL not set — Slack notification skipped');
    return;
  }
  const dot = score >= 20 ? ':large_green_circle:' : score >= 10 ? ':large_yellow_circle:' : ':white_circle:';
  const text = `<!channel> ${dot} *New Event Lead · Score ${score}/30 · ${priority}*\n*${data.name}* — ${data.email}\n*Revenue:* ${data.stage} · *Ticket:* ${data.ticket}\n*Business:* ${data.biz}`;
  const res = await fetch(SLACK_LEADS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) console.error(`[ct-mastermind-webhook] Slack post failed: ${res.status} ${await res.text()}`);
}

async function sendConfirmationEmail(email: string, firstName: string, itemName: string) {
  if (!BREVO_API_KEY || !email) return;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      templateId: TEMPLATE_CT_MASTERMIND_APPLICATION,
      to: [{ email, name: firstName }],
      params: { firstName, itemName },
    }),
  });
  if (!res.ok) console.error(`[ct-mastermind-webhook] Brevo email error ${res.status}: ${await res.text()}`);
}

async function addToBrevo(data: { name: string; email: string; phone: string }) {
  if (!BREVO_API_KEY) return;
  const parts = data.name.trim().split(' ');
  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      email: data.email,
      attributes: {
        FIRSTNAME: parts[0] ?? '',
        LASTNAME: parts.slice(1).join(' '),
        SMS: data.phone || undefined,
      },
      listIds: [BREVO_LIST_EVENTS],
      updateEnabled: true,
    }),
  });
  if (!res.ok && res.status !== 204) console.error(`[ct-mastermind-webhook] Brevo contact error ${res.status}: ${await res.text()}`);
}

async function createNotionEntry(data: {
  name: string; email: string; phone: string; insta: string;
  biz: string; stage: string; bottleneck: string; why: string;
  ticket: string; heard: string; score: number; priority: string;
}) {
  const stageLabel = STAGE_LABEL[data.stage] ?? data.stage;
  const notes = [
    data.email  && `Email: ${data.email}`,
    data.heard  && `How they heard: ${data.heard}`,
    data.stage  && `Revenue stage: ${data.stage}`,
    data.ticket && `Ticket type: ${data.ticket}`,
    `Lead score: ${data.score}/30 (${data.priority})`,
    data.bottleneck && `Bottleneck: ${data.bottleneck}`,
  ].filter(Boolean).join('\n');

  const body = {
    parent: { database_id: NOTION_CRM_DB_ID },
    properties: {
      Name:     { title: [{ text: { content: data.name } }] },
      Business: { rich_text: [{ text: { content: data.biz } }] },
      Type:     { multi_select: [{ name: 'Cape Town Mastermind' }] },
      Status:   { select: { name: 'Applied' } },
      'Last Interaction': { select: { name: 'Applied' } },
      Goals:    { rich_text: [{ text: { content: data.why } }] },
      Notes:    { rich_text: [{ text: { content: notes } }] },
      IG:       { rich_text: [{ text: { content: data.insta } }] },
      Phone:    { phone_number: data.phone || null },
      Revenue:  stageLabel ? { select: { name: stageLabel } } : undefined,
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
}

export const POST: APIRoute = async ({ request }) => {
  if (TALLY_WEBHOOK_SECRET) {
    const sig = request.headers.get('tally-webhook-secret');
    if (sig !== TALLY_WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 });
  } else {
    console.warn('[ct-mastermind-webhook] TALLY_WEBHOOK_SECRET not set — webhook is unauthenticated');
  }

  let payload: any;
  try { payload = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  if (payload.eventType !== 'FORM_RESPONSE') return new Response('OK', { status: 200 });

  const fields: any[] = payload.data?.fields ?? [];
  const name       = extractField(fields, FIELD.name);
  const email      = extractField(fields, FIELD.email);
  const phone      = extractField(fields, FIELD.phone);
  const insta      = extractField(fields, FIELD.insta);
  const biz        = extractField(fields, FIELD.biz);
  const stage      = extractField(fields, FIELD.stage);
  const bottleneck = extractField(fields, FIELD.bottleneck);
  const why        = extractField(fields, FIELD.why);
  const ticket     = extractField(fields, FIELD.ticket);
  const heard      = extractField(fields, FIELD.heard);
  const firstName  = name.trim().split(' ')[0] ?? '';
  const score      = calcScore(stage, ticket, why);
  const priority   = scorePriority(score);

  if (!name || !email) return new Response('Missing required fields', { status: 400 });

  console.log(`[ct-mastermind-webhook] New application: ${name} (${email}) — ${ticket} | score ${score} (${priority})`);

  waitUntil(
    Promise.all([
      createNotionEntry({ name, email, phone, insta, biz, stage, bottleneck, why, ticket, heard, score, priority }),
      addToBrevo({ name, email, phone }),
      sendConfirmationEmail(email, firstName, 'Cape Town Mastermind'),
      postLeadToSlack({ name, email, stage, ticket, biz }, score, priority),
    ]).catch((err: any) => console.error('[ct-mastermind-webhook] Error:', err.message))
  );

  return new Response('OK', { status: 200 });
};
