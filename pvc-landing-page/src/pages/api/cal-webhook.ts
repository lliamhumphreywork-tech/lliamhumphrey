export const prerender = false;
import type { APIRoute } from 'astro';
import crypto from 'crypto';
import { notionQuery, notionPatch, selectProp } from '../../lib/notion';

const CAL_WEBHOOK_SECRET      = import.meta.env.CAL_WEBHOOK_SECRET ?? '';
const BREVO_API_KEY           = import.meta.env.BREVO_API_KEY ?? '';
const SLACK_BOOKED_CALLS_URL  = import.meta.env.SLACK_BOOKED_CALLS_URL ?? '';
const ADMIN_URL               = 'https://privatevictoriesclub.com/admin';
const NOTION_CRM_DB           = '872bd20eee31468f91bed1cd472e157a';

function verifySignature(body: string, signature: string | null): boolean {
  if (!CAL_WEBHOOK_SECRET || !signature) return !CAL_WEBHOOK_SECRET;
  const expected = crypto.createHmac('sha256', CAL_WEBHOOK_SECRET).update(body).digest('hex');
  return expected === signature;
}

async function markCallBookedBrevo(email: string, bookedAt: string): Promise<void> {
  if (!BREVO_API_KEY || !email) return;
  await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      attributes: { CALL_BOOKED: bookedAt },
      updateEnabled: true,
    }),
  });
}

async function markCallBookedNotion(email: string): Promise<void> {
  if (!email) return;
  try {
    const pages = await notionQuery(NOTION_CRM_DB, {
      property: 'Email', email: { equals: email },
    });
    const page = pages[0];
    if (!page) return;
    const status = page.properties['Status']?.select?.name ?? '';
    // Only advance if currently Accepted (booking email sent but not yet call booked)
    if (status === 'Accepted') {
      await notionPatch(page.id, { Status: selectProp('Call Booked') });
    }
  } catch (e: any) {
    console.error('[cal-webhook] Notion update error:', e.message);
  }
}

function formatSAST(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    }) + ' SAST';
  } catch {
    return iso;
  }
}

async function postSlack(name: string, email: string, callTitle: string, startTime: string, meetingUrl: string): Promise<void> {
  if (!SLACK_BOOKED_CALLS_URL) return;
  const time = formatSAST(startTime);
  const adminLink = `${ADMIN_URL}`;
  const isAppCall = callTitle.toLowerCase().includes('application');
  const callLabel = isAppCall ? 'Application Call' : callTitle;

  const text = [
    `📅 *New call booked*`,
    `*${name}* — ${callLabel}`,
    `${time}`,
    meetingUrl ? meetingUrl : '',
    `<${adminLink}|Open CRM> · search: ${name}`,
  ].filter(Boolean).join('\n');

  await fetch(SLACK_BOOKED_CALLS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const signature = request.headers.get('x-cal-signature-256');

  if (!verifySignature(body, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(body); } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = payload.triggerEvent ?? payload.type ?? '';
  if (!['BOOKING_CREATED', 'booking.created'].includes(event)) {
    return new Response('OK', { status: 200 });
  }

  const p = payload.payload ?? payload;
  const attendee        = p.attendees?.[0] ?? {};
  const attendeeEmail   = attendee.email ?? p.responses?.email?.value ?? '';
  const attendeeName    = attendee.name  ?? p.responses?.name?.value  ?? attendeeEmail;
  const startTime       = p.startTime ?? new Date().toISOString();
  const callTitle       = p.title ?? p.eventTitle ?? 'Private Victories Call';
  const meetingUrl      = p.metadata?.videoCallUrl ?? p.videoCallUrl ?? '';

  await Promise.allSettled([
    attendeeEmail ? markCallBookedBrevo(attendeeEmail, startTime) : Promise.resolve(),
    attendeeEmail ? markCallBookedNotion(attendeeEmail) : Promise.resolve(),
    postSlack(attendeeName, attendeeEmail, callTitle, startTime, meetingUrl),
  ]);

  if (attendeeEmail) console.log(`[cal-webhook] BOOKING_CREATED — ${attendeeName} <${attendeeEmail}>`);

  return new Response('OK', { status: 200 });
};
