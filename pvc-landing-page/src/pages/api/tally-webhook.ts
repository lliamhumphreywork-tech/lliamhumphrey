export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DB_ID = '872bd20eee31468f91bed1cd472e157a';
const TALLY_WEBHOOK_SECRET = import.meta.env.TALLY_WEBHOOK_SECRET;
const BREVO_API_KEY = import.meta.env.BREVO_API_KEY;
const TEMPLATE_APPLICATION_RECEIVED = 30;

// List 6 = PVC Dinner Applications (all applicants)
// List 7 = Tier B (R10k+), List 8 = Tier C (R0-R10k), List 9 = Pre-revenue
const BREVO_LIST_ALL = 6;
const STAGE_TO_LIST: Record<string, number> = {
  'Pre-revenue':        9,
  'R0 - R10,000':      8,
  'R10,000 - R50,000': 7,
  'R50,000 - R100,000':7,
  'R100,000+':         7,
};

// Field labels from the Tally form
const FIELD = {
  name:    'Full Name',
  email:   'Email Address',
  phone:   'Phone Number',
  biz:     'What business are you currently building?',
  stage:   'What stage are you currently at?',
  why:     'Why do you want a seat at this dinner?',
  insta:   'Instagram or TikTok',
  heard:   'How did you hear about PVC?',
};

const STAGE_SCORE: Record<string, number> = {
  'Pre-revenue': 0,
  'R0 - R10,000': 1,
  'R10,000 - R50,000': 2,
  'R50,000 - R100,000': 3,
  'R100,000+': 4,
};

const STAGE_LABEL: Record<string, string> = {
  'Pre-revenue':        'Pre-revenue',
  'R0 - R10,000':      'R0-R10k',
  'R10,000 - R50,000': 'R10k-R50k',
  'R50,000 - R100,000':'R50k-R100k',
  'R100,000+':         'R100k+',
};

function scoreApplication(stage: string, why: string): { stageScore: number; qualityScore: number; total: number; tier: string } {
  const stageScore = STAGE_SCORE[stage] ?? 0;
  const qualityScore = Math.min(3, Math.floor(why.trim().split(/\s+/).length / 15));
  const total = stageScore + qualityScore;
  const tier = total >= 5 ? 'A' : total >= 3 ? 'B' : 'C';
  return { stageScore, qualityScore, total, tier };
}

function extractField(fields: any[], label: string): string {
  const field = fields.find((f: any) => f.label === label);
  if (!field) return '';
  // Tally returns value as string or array of option objects
  if (Array.isArray(field.value)) {
    return field.value.map((v: any) => v.text ?? v).join(', ');
  }
  return String(field.value ?? '');
}

async function addToBrevo(data: {
  name: string; email: string; phone: string; stage: string;
}) {
  if (!BREVO_API_KEY) return;
  const nameParts = data.name.trim().split(' ');
  const firstName = nameParts[0] ?? '';
  const lastName = nameParts.slice(1).join(' ');
  const tierList = STAGE_TO_LIST[data.stage];
  const listIds = tierList ? [BREVO_LIST_ALL, tierList] : [BREVO_LIST_ALL];

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
        FIRSTNAME: firstName,
        LASTNAME: lastName,
        SMS: data.phone || undefined,
      },
      listIds,
      updateEnabled: true,
    }),
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    console.error(`[tally-webhook] Brevo error ${res.status}: ${err}`);
  }
}

async function sendApplicationConfirmation(email: string, firstName: string) {
  if (!BREVO_API_KEY || !email) return;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ templateId: TEMPLATE_APPLICATION_RECEIVED, to: [{ email, name: firstName }], params: { firstName } }),
  });
  if (!res.ok) console.error(`[tally-webhook] Brevo confirmation error ${res.status}: ${await res.text()}`);
}

async function createNotionEntry(data: {
  name: string; email: string; phone: string;
  biz: string; stage: string; why: string;
  insta: string; heard: string; score: number; tier: string;
}) {
  const notes = [
    data.email && `Email: ${data.email}`,
    data.heard && `How they heard: ${data.heard}`,
    `Revenue stage: ${data.stage}`,
    `Tier: ${data.tier} | Score: ${data.score}/7`,
  ].filter(Boolean).join('\n');

  const body: any = {
    parent: { database_id: NOTION_DB_ID },
    properties: {
      Name:    { title: [{ text: { content: data.name } }] },
      Business:{ rich_text: [{ text: { content: data.biz } }] },
      Type:    { multi_select: [{ name: 'Dinner Applicant' }] },
      Status:  { select: { name: 'Applied' } },
      'Last Interaction': { select: { name: 'Applied' } },
      'Application Score': { number: data.score },
      Goals:   { rich_text: [{ text: { content: data.why } }] },
      Notes:   { rich_text: [{ text: { content: notes } }] },
      IG:      { rich_text: [{ text: { content: data.insta } }] },
      Phone:   { phone_number: data.phone || null },
      Revenue: { select: STAGE_LABEL[data.stage] ? { name: STAGE_LABEL[data.stage] } : null },
    },
  };

  if (data.score >= 3) {
    body.properties['Potential Member?'] = { checkbox: true };
  }

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
    if (sig !== TALLY_WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 });
  } else {
    console.warn('[tally-webhook] TALLY_WEBHOOK_SECRET not set — webhook is unauthenticated');
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Only handle form responses
  if (payload.eventType !== 'FORM_RESPONSE') {
    return new Response('OK', { status: 200 });
  }

  const fields: any[] = payload.data?.fields ?? [];
  const name   = extractField(fields, FIELD.name);
  const email  = extractField(fields, FIELD.email);
  const phone  = extractField(fields, FIELD.phone);
  const biz    = extractField(fields, FIELD.biz);
  const stage  = extractField(fields, FIELD.stage);
  const why    = extractField(fields, FIELD.why);
  const insta  = extractField(fields, FIELD.insta);
  const heard  = extractField(fields, FIELD.heard);

  if (!name || !email) {
    return new Response('Missing required fields', { status: 400 });
  }

  const { total, tier } = scoreApplication(stage, why);
  const firstName = name.trim().split(' ')[0] ?? '';

  // Respond immediately so Tally doesn't timeout (10s limit),
  // then process Notion + Brevo in the background.
  waitUntil(
    Promise.all([
      createNotionEntry({ name, email, phone, biz, stage, why, insta, heard, score: total, tier }),
      addToBrevo({ name, email, phone, stage }),
      sendApplicationConfirmation(email, firstName),
    ]).then(() => {
      console.log(`[tally-webhook] Processed ${name} (${email}) — Tier ${tier}, Score ${total}/7`);
    }).catch((err: any) => {
      console.error('[tally-webhook] Background error:', err.message);
    })
  );

  return new Response('OK', { status: 200 });
};
