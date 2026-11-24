export const prerender = false;
import type { APIRoute } from 'astro';
import { notionQuery, notionPatch, numProp, dateProp, getTitle, getEmail, getPhone, getDate, getNum, getSelect } from '../../../lib/notion';

const CRON_SECRET  = import.meta.env.CRON_SECRET ?? '';
const ADMIN_KEY    = import.meta.env.ADMIN_KEY   ?? '';
const BREVO_KEY    = import.meta.env.BREVO_API_KEY ?? '';
const CAL_URL      = import.meta.env.PVC_APPLICATION_CALL_URL ?? 'https://cal.com/lliam-humphrey-q82xct/pvcapplicationcall';
const NOTION_CRM   = '872bd20eee31468f91bed1cd472e157a';
const MAX_PER_RUN  = 10;

const STOP_STATUSES = new Set([
  'Call Booked', 'Discovery Call Booked', 'Call Done', 'Paid', 'Onboarding',
  'Member', 'Founding Member', 'Membership Activated', 'Rejected',
  'Free Community Funnel', 'Disqualified',
]);

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

function followup1Html(name: string): string {
  return [
    `<p>Hey ${name},</p>`,
    `<p>Saw you haven't booked yet. I've got a couple of slots open, want one?</p>`,
    `<p><a href="${CAL_URL}">Book my call</a></p>`,
    `<p>Lliam</p>`,
  ].join('');
}

function followup2Html(name: string): string {
  return [
    `<p>${name}, last one from me.</p>`,
    `<p>Still keen to chat, but I won't chase forever. Let me know either way.</p>`,
    `<p><a href="${CAL_URL}">Book my call</a></p>`,
    `<p>Lliam</p>`,
  ].join('');
}

async function sendEmail(email: string, name: string, followupNum: number): Promise<boolean> {
  if (!BREVO_KEY) return false;
  const subject = followupNum === 1 ? `Hey ${name}` : name;
  const html    = followupNum === 1 ? followup1Html(name) : followup2Html(name);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:      { name: 'Lliam', email: 'lliamhumphreywork@gmail.com' },
      to:          [{ email, name }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    console.error(`[booking-followup] Brevo ${res.status}: ${await res.text()}`);
    return false;
  }
  return true;
}

export const GET: APIRoute = async ({ request }) => {
  const isCron  = request.headers.get('x-vercel-cron') === '1';
  const isAdmin = ADMIN_KEY && request.headers.get('x-admin-key') === ADMIN_KEY;
  if (!isCron && !isAdmin) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const dry  = url.searchParams.get('dry') === 'true';

  let pages: any[];
  try {
    pages = await notionQuery(NOTION_CRM, {
      and: [
        { property: 'Status', select: { equals: 'Accepted' } },
        { property: 'Booking Email Sent', date: { is_not_empty: true } },
      ],
    });
  } catch (e: any) {
    console.error('[booking-followup] Notion query error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const results: any[] = [];
  let sent = 0;

  for (const page of pages) {
    if (sent >= MAX_PER_RUN) {
      results.push({ id: page.id, action: 'skipped', reason: 'max_per_run' });
      continue;
    }

    const p      = page.properties;
    const status = getSelect(p, 'Status');
    if (STOP_STATUSES.has(status)) {
      results.push({ id: page.id, action: 'skipped', reason: `stop_status:${status}` });
      continue;
    }

    const fullName    = getTitle(p, 'Name');
    const firstName   = fullName.split(' ')[0] || '';
    const name        = firstName || 'there';
    const email       = getEmail(p, 'Email');
    const sentDate    = getDate(p, 'Booking Email Sent');
    const followCount = getNum(p, 'Follow-up Count') ?? 0;
    const days        = sentDate ? daysSince(sentDate) : 0;

    if (!email) {
      results.push({ id: page.id, action: 'skipped', reason: 'no_email' });
      continue;
    }
    if (followCount >= 2) {
      results.push({ id: page.id, name: firstName, action: 'skipped', reason: 'max_followups' });
      continue;
    }

    const shouldSend   = (followCount === 0 && days >= 1) || (followCount === 1 && days >= 3);
    const followupNum  = followCount === 0 ? 1 : 2;

    if (!shouldSend) {
      results.push({ id: page.id, name: firstName, action: 'waiting', days, followCount });
      continue;
    }

    if (dry) {
      console.log(`[booking-followup] DRY followup-${followupNum} → ${email} (${name})`);
      results.push({ id: page.id, name: firstName, action: 'dry_send', followupNum, days });
      continue;
    }

    const ok = await sendEmail(email, name, followupNum);
    if (ok) {
      sent++;
      const today = new Date().toISOString().split('T')[0];
      await notionPatch(page.id, {
        'Follow-up Count': numProp(followCount + 1),
        'Last Follow-up':  dateProp(today),
      }).catch((e: any) => console.error('[booking-followup] Notion patch error:', e.message));
      results.push({ id: page.id, name: firstName, action: 'sent', followupNum, days });
    } else {
      results.push({ id: page.id, name: firstName, action: 'failed', followupNum });
    }
  }

  console.log(`[booking-followup] Done — ${sent} sent, ${results.length} leads checked${dry ? ' [DRY]' : ''}`);

  return new Response(JSON.stringify({ ok: true, dry, sent, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
