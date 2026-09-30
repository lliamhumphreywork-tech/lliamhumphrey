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
  const text = await res.text();
  // Return a trimmed structural peek so we can see field shapes
  try {
    const data = JSON.parse(text);
    const peek: any = {
      status: res.status,
      topLevelKeys: Object.keys(data),
      totalSubmissions: data.totalNumberOfSubmissionsPerFilter ?? data.total ?? '?',
      questionsCount: (data.questions ?? []).length,
      question0: data.questions?.[0] ?? null,
      responsesCount: (data.responses ?? data.submissions ?? []).length,
      response0keys: Object.keys((data.responses ?? data.submissions ?? [])[0] ?? {}),
      response0field0: (data.responses ?? data.submissions ?? [])[0]?.fields?.[0] ?? null,
    };
    return new Response(JSON.stringify(peek, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ status: res.status, raw: text.slice(0, 500) }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
