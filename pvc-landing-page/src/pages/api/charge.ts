export const prerender = false;

import type { APIRoute } from 'astro';

const YOCO_SECRET_KEY = import.meta.env.YOCO_SECRET_KEY;

export const POST: APIRoute = async ({ request }) => {
  const { token, amountInCents, currency = 'ZAR', metadata } = await request.json();

  if (!token || !amountInCents) {
    return new Response(JSON.stringify({ error: 'Missing token or amount' }), { status: 400 });
  }
  // Reject suspiciously low amounts (minimum R10 = 1000 cents)
  if (typeof amountInCents !== 'number' || amountInCents < 1000) {
    return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400 });
  }

  const res = await fetch('https://payments.yoco.com/api/charges', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, amountInCents, currency, metadata }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[charge] Yoco error:', JSON.stringify(data));
    return new Response(JSON.stringify({ error: data?.displayMessage ?? 'Payment failed' }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, id: data.id }), { status: 200 });
};
