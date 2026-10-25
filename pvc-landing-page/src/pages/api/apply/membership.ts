export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';
import { notionQuery, notionPatch, notionCreate, titleProp, textProp, emailProp, phoneProp, selectProp, multiProp, dateProp, numProp } from '../../../lib/notion';
import { sendTemplate, enrollContact } from '../../../lib/brevo';
import { postWebhook } from '../../../lib/slack';

const NOTION_DB_ID      = '872bd20eee31468f91bed1cd472e157a';
const SLACK_LEADS_URL   = import.meta.env.SLACK_LEADS_URL ?? '';
const ANTHROPIC_API_KEY = import.meta.env.ANTHROPIC_API_KEY;

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
  try {
    const results = await notionQuery(NOTION_DB_ID, {
      filter: { property: 'Email', email: { equals: email } },
      page_size: 1,
    });
    return results.length > 0;
  } catch {
    return false;
  }
}

async function scoreApplication(data: {
  name: string; business: string; revenue: string;
  tangible_result: string; contribute_gain: string; working_on: string;
  business_needs: string; winning_looks_like: string; commitment: string;
}): Promise<{ score: number; verdict: string } | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: `You are screening applicants for Private Victories Club (PVC), a high-performance business community for South African entrepreneurs doing R20k–R500k+/month. The room is curated — people who show up, contribute, and are serious about growth.

Score this applicant 1–10 and write a one-sentence verdict. Return ONLY valid JSON: {"score": <number>, "verdict": "<sentence>"}

Scoring guide:
- 8–10: R50k+/month, clear specific goals, wants to contribute not just take, strong commitment
- 5–7: R20k–R50k/month, reasonable goals, some ambition
- 2–4: Pre-revenue or vague/generic answers
- 1: Clearly not a fit

Applicant:
Name: ${data.name}
Business: ${data.business}
Revenue: ${data.revenue}
Working on: ${data.working_on || 'not provided'}
3-month goal: ${data.tangible_result || 'not provided'}
Contribute/gain: ${data.contribute_gain || 'not provided'}
Needs: ${data.business_needs || 'not provided'}
12-month win: ${data.winning_looks_like || 'not provided'}
Commitment: ${data.commitment || 'not provided'}`,
        }],
      }),
    });
    if (!res.ok) { console.error(`[apply/membership] AI score ${res.status}`); return null; }
    const ai = await res.json();
    const parsed = JSON.parse(ai.content?.[0]?.text ?? '{}');
    if (typeof parsed.score === 'number' && typeof parsed.verdict === 'string') {
      return { score: Math.min(10, Math.max(1, Math.round(parsed.score))), verdict: parsed.verdict };
    }
    return null;
  } catch (e: any) {
    console.error('[apply/membership] AI score error:', e.message);
    return null;
  }
}

async function patchApplicationScore(pageId: string, score: number, verdict: string, baseNotes: string) {
  const updatedNotes = (`AI: ${score}/10 — ${verdict}\n` + baseNotes).slice(0, 2000);
  await notionPatch(pageId, {
    'Application Score': numProp(score),
    Notes:               textProp(updatedNotes),
  }).catch((e: any) => console.error(`[apply/membership] Score patch error:`, e.message));
}

async function createNotionEntry(data: {
  name: string; email: string; phone: string; instagram: string;
  business: string; revenue: string; prompt: string; commitment: string;
  tag: string; notion_revenue: string; source: string;
  tangible_result: string; contribute_gain: string; working_on: string;
  business_needs: string; winning_looks_like: string;
}): Promise<{ pageId: string; notesText: string }> {
  const notionCommitment = COMMITMENT_MAP[data.commitment] ?? data.commitment;
  const isPreRevenue = data.revenue === 'R0 – R20k/month';

  const notesText = [
    `Tag: ${data.tag}${data.source ? ' | Source: ' + data.source : ''}`,
    data.tangible_result    ? `\n3-month result: ${data.tangible_result}`    : '',
    data.contribute_gain    ? `\nContribute/gain: ${data.contribute_gain}`   : '',
    data.working_on         ? `\nWorking on: ${data.working_on}`             : '',
    data.business_needs     ? `\nNeeds: ${data.business_needs}`              : '',
    data.winning_looks_like ? `\n12-month win: ${data.winning_looks_like}`   : '',
  ].join('').slice(0, 2000);

  const page = await notionCreate(NOTION_DB_ID, {
    Name:              titleProp(data.name),
    Email:             emailProp(data.email),
    Phone:             phoneProp(data.phone || null),
    IG:                textProp(data.instagram),
    Business:          textProp(data.business),
    Revenue:           data.notion_revenue ? selectProp(data.notion_revenue) : { select: null },
    Goals:             textProp(data.prompt),
    Commitment:        notionCommitment ? selectProp(notionCommitment) : { select: null },
    'Submission Date': dateProp(new Date().toISOString().split('T')[0]),
    Status:            selectProp(isPreRevenue ? 'Free Community Funnel' : 'Pending Review'),
    Type:              multiProp(['Membership Applicant']),
    Notes:             textProp(notesText),
  });

  return { pageId: page.id, notesText };
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

  const appData = {
    name: name.trim(), email: email.trim().toLowerCase(), phone: phone ?? '',
    instagram: instagram ?? '', business: business ?? '', revenue,
    prompt: prompt.trim(), commitment: commitment ?? '', tag, notion_revenue, source,
    tangible_result: tangible_result ?? '', contribute_gain: contribute_gain ?? '',
    working_on: working_on ?? '', business_needs: business_needs ?? '',
    winning_looks_like: winning_looks_like ?? '',
  };

  const dot = (revenue === 'R500k+/month' || revenue === 'R250k – R500k/month') ? ':large_green_circle:' :
              revenue === 'R0 – R20k/month' ? ':white_circle:' : ':large_yellow_circle:';

  waitUntil(
    Promise.all([
      createNotionEntry(appData).then(async ({ pageId, notesText }) => {
        const ai = await scoreApplication({
          name: appData.name, business: appData.business, revenue: appData.revenue,
          tangible_result: appData.tangible_result, contribute_gain: appData.contribute_gain,
          working_on: appData.working_on, business_needs: appData.business_needs,
          winning_looks_like: appData.winning_looks_like, commitment: appData.commitment,
        });
        if (ai) await patchApplicationScore(pageId, ai.score, ai.verdict, notesText);
      }),
      enrollContact(appData.email, {
        FIRSTNAME: firstName, LASTNAME: lastName,
        SMS: phone || undefined, PVC_TAG: tag,
      }, listIds),
      sendTemplate(TEMPLATE_CONFIRMATION, { email: appData.email, name: firstName }),
      ...(isPreRevenue ? [sendTemplate(TEMPLATE_NURTURE, { email: appData.email, name: firstName })] : []),
      postWebhook(SLACK_LEADS_URL, `<!channel> ${dot} *New Application · ${tag}*\n*${appData.name}* — ${appData.email}\n*Revenue:* ${revenue}\n*Business:* ${appData.business}${source ? `\n*Source:* ${source}` : ''}`),
    ]).then(() => {
      console.log(`[apply/membership] Processed ${name} — ${revenue} | ${tag}`);
    }).catch((err: any) => {
      console.error('[apply/membership] Background error:', err.message);
    })
  );

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
