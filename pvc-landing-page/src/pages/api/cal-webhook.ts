export const prerender = false;

import type { APIRoute } from 'astro';
import crypto from 'crypto';

const POSTHOG_HOST    = 'https://eu.posthog.com';
const POSTHOG_API_KEY = import.meta.env.POSTHOG_API_KEY ?? '';
const CAL_WEBHOOK_SECRET = import.meta.env.CAL_WEBHOOK_SECRET ?? '';

function verifyCalSignature(body: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature) return !secret; // if no secret configured, allow all
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${hash}` === signature;
}

async function captureEvent(event: string, distinctId: string, properties: Record<string, any>) {
  if (!POSTHOG_API_KEY) return;
  await fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: POSTHOG_API_KEY,
      event,
      distinct_id: distinctId,
      properties,
    }),
  }).catch(e => console.error('[cal-webhook] PostHog capture failed:', e.message));
}

export const POST: APIRoute = async ({ request }) => {
  const body      = await request.text();
  const signature = request.headers.get('x-cal-signature-256');

  if (!verifyCalSignature(body, signature, CAL_WEBHOOK_SECRET)) {
    console.warn('[cal-webhook] Signature verification failed');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const triggerEvent = payload.triggerEvent ?? payload.type ?? '';
  const booking      = payload.payload ?? payload;

  const attendee  = booking.attendees?.[0] ?? {};
  const email     = attendee.email ?? booking.responses?.email?.value ?? '';
  const name      = attendee.name  ?? booking.responses?.name?.value  ?? '';
  const eventTitle = booking.title ?? booking.eventType?.title ?? '';
  const startTime  = booking.startTime ?? '';
  const bookingUid = booking.uid ?? '';

  console.log(`[cal-webhook] ${triggerEvent} | ${name} (${email}) | ${eventTitle}`);

  if (triggerEvent === 'BOOKING_CREATED' || triggerEvent === 'booking.created') {
    await captureEvent('call_booked', email || bookingUid, {
      email,
      name,
      event_title: eventTitle,
      start_time: startTime,
      booking_uid: bookingUid,
      $set: { email, name },
    });
  } else if (triggerEvent === 'BOOKING_CANCELLED' || triggerEvent === 'booking.cancelled') {
    await captureEvent('call_cancelled', email || bookingUid, {
      email,
      name,
      event_title: eventTitle,
      booking_uid: bookingUid,
    });
  } else if (triggerEvent === 'BOOKING_RESCHEDULED' || triggerEvent === 'booking.rescheduled') {
    await captureEvent('call_rescheduled', email || bookingUid, {
      email,
      name,
      event_title: eventTitle,
      new_start_time: startTime,
      booking_uid: bookingUid,
    });
  }

  return new Response('OK', { status: 200 });
};
