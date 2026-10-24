export const prerender = false;

// TEMPORARY test endpoint — remove after end-to-end test is confirmed
// Crafts a signed charge.success payload and POSTs it to the webhook internally
// Auth: requires ADMIN_KEY header to prevent accidental triggers

import type { APIRoute } from 'astro';
import crypto from 'crypto';

export const POST: APIRoute = async ({ request }) => {
  const adminKey = import.meta.env.ADMIN_KEY;
  if (!adminKey || request.headers.get('x-admin-key') !== adminKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  const secret = import.meta.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'PAYSTACK_SECRET_KEY not set' }), { status: 500 });
  }

  const testRef = `TEST-${Date.now()}`;

  const payload = JSON.stringify({
    event: 'charge.success',
    data: {
      reference: testRef,
      amount: 299900,
      customer: { email: 'webhook-test@privatevictoriesclub.com', first_name: 'Webhook', last_name: 'Test' },
      metadata: {
        name: 'Webhook Test',
        item_name: 'PVC Membership - Test',
        email: 'webhook-test@privatevictoriesclub.com',
      },
    },
  });

  const sig = crypto.createHmac('sha512', secret).update(payload).digest('hex');

  const origin = request.headers.get('origin') ?? `https://${request.headers.get('host')}`;

  const res = await fetch(`${origin}/api/paystack-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': sig,
    },
    body: payload,
  });

  return new Response(
    JSON.stringify({ status: res.status, ref: testRef, ok: res.ok }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
