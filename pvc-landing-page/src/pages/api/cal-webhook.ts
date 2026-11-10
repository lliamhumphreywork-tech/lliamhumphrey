export const prerender = false;
import type { APIRoute } from 'astro';
import crypto from 'crypto';

const CAL_WEBHOOK_SECRET = import.meta.env.CAL_WEBHOOK_SECRET ?? '';
const BREVO_API_KEY      = import.meta.env.BREVO_API_KEY ?? '';

function verifySignature(body: string, signature: string | null): boolean {
  if (!CAL_WEBHOOK_SECRET || !signature) return !CAL_WEBHOOK_SECRET; // allow if no secret set
  const expected = crypto.createHmac('sha256', CAL_WEBHOOK_SECRET).update(body).digest('hex');
  return expected === signature;
}

async function markCallBooked(email: string, bookedAt: string): Promise<void> {
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
  const attendeeEmail: string = p.attendees?.[0]?.email ?? p.responses?.email?.value ?? '';
  const bookedAt = p.startTime ?? new Date().toISOString();

  if (attendeeEmail) {
    await markCallBooked(attendeeEmail, bookedAt);
    console.log(`[cal-webhook] Marked CALL_BOOKED for ${attendeeEmail}`);
  }

  return new Response('OK', { status: 200 });
};
