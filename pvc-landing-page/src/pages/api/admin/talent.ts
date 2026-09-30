export const prerender = false;
import type { APIRoute } from 'astro';

const TALLY_API_KEY = import.meta.env.TALLY_API_KEY;
const TALENT_FORM   = 'dWJdNz';
const ADMIN_KEY     = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

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
  // Build questionId → title map
  const qMap: Record<string, string> = {};
  for (const q of questions) {
    if (q.id) qMap[q.id] = q.title ?? q.label ?? q.id;
  }

  return submissions.map((sub: any) => {
    // Each answer: { questionId, answer }
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
    const proof    = get(['portfolio', 'proof of work', 'proof', 'link only']);
    const notes    = get(['recent client', 'outcome', 'tell us']);
    const rate     = get(['rate/pricing', 'rate', 'pricing', 'price', 'fee']);
    const capacity = get(['how many clients', 'capacity', 'realistically']);
    const member   = get(['private victories member', 'currently a member', 'pvc member']);

    const taken = new Set([name, email, phone, skills, proof, notes, rate, capacity, member].filter(Boolean));
    const extra = answers
      .filter(a => !taken.has(a.value))
      .map(a => ({ label: a.title, value: a.value }));

    return {
      id:       sub.id,
      n:        name || answers[0]?.value || 'Unknown',
      e:        email,
      p:        phone,
      skills,
      rate,
      proof,
      notes,
      capacity,
      member,
      extra,
      since:    (sub.submittedAt ?? sub.createdAt ?? '').slice(0, 10),
      url:      `https://tally.so/forms/${TALENT_FORM}/submissions`,
    };
  });
}

async function fetchTally() {
  if (!TALLY_API_KEY) return null;

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

  return { questions: allQuestions, submissions: allSubmissions };
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const result = await fetchTally();

  if (result === null) {
    return new Response(JSON.stringify({ noKey: true, supply: [], demand: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const entries = parseSubmissions(result.questions, result.submissions);

  return new Response(JSON.stringify({ noKey: false, supply: entries, demand: [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
