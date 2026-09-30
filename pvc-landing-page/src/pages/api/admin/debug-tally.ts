export const prerender = false;
import type { APIRoute } from 'astro';

const TALLY_API_KEY = import.meta.env.TALLY_API_KEY;
const ADMIN_KEY     = import.meta.env.ADMIN_KEY;

export const GET: APIRoute = async ({ request }) => {
  if (ADMIN_KEY !== '' && request.headers.get('x-admin-key') !== ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
  const res = await fetch(
    'https://api.tally.so/forms/dWJdNz/submissions?page=1&limit=1',
    { headers: { Authorization: `Bearer ${TALLY_API_KEY}` } }
  );
  const raw = await res.json();
  return new Response(JSON.stringify(raw, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
