export const prerender = false;
import type { APIRoute } from 'astro';

const TALLY_API_KEY = import.meta.env.TALLY_API_KEY;
const TALENT_FORM   = 'dWJdNz';

// Lightweight token so this endpoint isn't fully public
// Members portal calls it with the same MEMBERS_TOKEN env var
const MEMBERS_TOKEN = import.meta.env.MEMBERS_API_TOKEN;

function strVal(v: any): string {
  if (!v && v !== 0) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function hits(title: string, keywords: string[]): boolean {
  const t = title.toLowerCase();
  return keywords.some(k => t.includes(k));
}

function parseSubmissions(questions: any[], submissions: any[]) {
  const qMap: Record<string, string> = {};
  for (const q of questions) {
    if (q.id) qMap[q.id] = q.title ?? q.label ?? q.id;
  }

  return submissions.map((sub: any) => {
    const answers: Array<{ title: string; value: string }> =
      (sub.responses ?? [])
        .map((r: any) => ({
          title: qMap[r.questionId] ?? r.questionId ?? '',
          value: strVal(r.answer),
        }))
        .filter((a: any) => a.value);

    const get = (keywords: string[]) =>
      answers.find(a => hits(a.title, keywords))?.value ?? '';

    const name     = get(['full name', 'name']);
    const email    = get(['email']);
    const phone    = get(['whatsapp', 'phone', 'number', 'contact']);
    const skills   = get(['what do you do', 'skill', 'service', 'offer', 'expertise']);
    const rate     = get(['rate/pricing', 'rate', 'pricing', 'price', 'fee']);
    const proof    = get(['portfolio', 'proof of work', 'proof', 'link only']);
    const notes    = get(['recent client', 'outcome', 'tell us']);
    const capacity = get(['how many clients', 'capacity', 'realistically']);
    const member   = get(['private victories member', 'currently a member', 'pvc member']);

    return {
      id:    sub.id,
      name:  name || answers[0]?.value || 'Unknown',
      email,
      phone,
      skills,
      rate,
      proof,
      notes,
      capacity,
      member,
      since: (sub.submittedAt ?? sub.createdAt ?? '').slice(0, 10),
    };
  });
}

export const GET: APIRoute = async ({ request }) => {
  // Require the shared members token
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!MEMBERS_TOKEN || token !== MEMBERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!TALLY_API_KEY) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }

  let allQuestions: any[] = [];
  let allSubmissions: any[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.tally.so/forms/${TALENT_FORM}/submissions?page=${page}&limit=100`,
      { headers: { Authorization: `Bearer ${TALLY_API_KEY}` } }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (page === 1) allQuestions = data.questions ?? [];
    const batch = data.submissions ?? data.responses ?? data.data ?? [];
    allSubmissions.push(...batch);
    if (!data.hasMore || batch.length < 100) break;
    page++;
  }

  const entries = parseSubmissions(allQuestions, allSubmissions);

  return new Response(JSON.stringify(entries), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300',
    },
  });
};
