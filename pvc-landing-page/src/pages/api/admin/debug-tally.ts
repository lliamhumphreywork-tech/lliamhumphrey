export const prerender = false;
import type { APIRoute } from 'astro';

const TALLY_API_KEY = import.meta.env.TALLY_API_KEY;
const ADMIN_KEY     = import.meta.env.ADMIN_KEY;

export const GET: APIRoute = async ({ request }) => {
  if (ADMIN_KEY && request.headers.get('x-admin-key') !== ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
  const res = await fetch(
    'https://api.tally.so/forms/dWJdNz/submissions?page=1&limit=1',
    { headers: { Authorization: `Bearer ${TALLY_API_KEY}` } }
  );
  const data = await res.json();
  const sub = (data.submissions ?? data.responses ?? [])[0] ?? {};
  const answers = sub.responses ?? sub.fields ?? [];
  return new Response(JSON.stringify({
    topKeys: Object.keys(data),
    question0: data.questions?.[0] ?? null,
    submissionKeys: Object.keys(sub),
    answersCount: answers.length,
    answer0: answers[0] ?? null,
    answer1: answers[1] ?? null,
  }, null, 2), { headers: { 'Content-Type': 'application/json' } });
};
