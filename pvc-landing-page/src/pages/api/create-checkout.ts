export const prerender = false;

import type { APIRoute } from 'astro';

const YOCO_SECRET_KEY = import.meta.env.YOCO_SECRET_KEY;

export const POST: APIRoute = async ({ request }) => {
  const { amountInCents, currency = 'ZAR', metadata, successUrl, cancelUrl } = await request.json();

  if (!amountInCents) {
    return new Response(JSON.stringify({ error: 'Missing amount' }), { status: 400 });
  }
  if (typeof amountInCents !== 'number' || amountInCents < 1000) {
    return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400 });
  }
  // Only allow redirects back to our own domain
  const ALLOWED_ORIGIN = 'https://privatevictoriesclub.com';
  if (successUrl && !successUrl.startsWith(ALLOWED_ORIGIN)) {
    return new Response(JSON.stringify({ error: 'Invalid successUrl' }), { status: 400 });
  }
  if (cancelUrl && !cancelUrl.startsWith(ALLOWED_ORIGIN)) {
    return new Response(JSON.stringify({ error: 'Invalid cancelUrl' }), { status: 400 });
  }

  const body: Record<string, unknown> = { amount: amountInCents, currency, metadata };
  if (successUrl) body.successUrl = successUrl;
  if (cancelUrl) body.cancelUrl = cancelUrl;

  const res = await fetch('https://payments.yoco.com/api/checkouts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[create-checkout] Yoco error:', JSON.stringify(data));
    return new Response(JSON.stringify({ error: 'Failed to create checkout' }), { status: 500 });
  }

  return new Response(JSON.stringify({ redirectUrl: data.redirectUrl }), { status: 200 });
};
