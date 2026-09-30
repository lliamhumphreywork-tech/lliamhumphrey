export const prerender = false;
import type { APIRoute } from 'astro';

const TALLY_API_KEY = import.meta.env.TALLY_API_KEY;
const TALENT_FORM   = 'dWJdNz';
const ADMIN_KEY     = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

function val(v: any): string {
  if (!v && v !== 0) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function match(label: string, keywords: string[]): boolean {
  const l = label.toLowerCase();
  return keywords.some(k => l.includes(k));
}

function parseResponses(questions: any[], responses: any[]) {
  // Build key → label map from the questions schema
  const keyLabel: Record<string, string> = {};
  for (const q of questions) {
    if (q.key) keyLabel[q.key] = q.label ?? q.title ?? q.key;
    // multi-column questions have nested fields
    for (const f of q.fields ?? []) {
      if (f.key) keyLabel[f.key] = f.label ?? q.label ?? f.key;
    }
  }

  return responses.map((resp: any) => {
    // Each response field has key+value but no label — resolve from map
    const fields: Array<{ label: string; value: string; key: string }> =
      (resp.fields ?? []).map((f: any) => ({
        key:   f.key ?? '',
        label: keyLabel[f.key] ?? f.key ?? '',
        value: val(f.value),
      })).filter((f: any) => f.value);

    const get = (keywords: string[]) =>
      fields.find(f => match(f.label, keywords))?.value ?? '';

    const name     = get(['full name', 'name']);
    const email    = get(['email']);
    const phone    = get(['whatsapp', 'phone', 'number', 'contact']);
    const skills   = get(['what do you do', 'skill', 'service', 'offer', 'expertise']);
    const proof    = get(['portfolio', 'proof of work', 'proof', 'link only']);
    const notes    = get(['recent client', 'outcome', 'tell us', 'about']);
    const rate     = get(['rate/pricing', 'rate', 'pricing', 'budget', 'price', 'fee']);
    const capacity = get(['how many clients', 'capacity', 'realistically']);
    const member   = get(['private victories member', 'currently a member', 'pvc member']);

    const taken = new Set([name, email, phone, skills, proof, notes, rate, capacity, member].filter(Boolean));
    const extra = fields
      .filter(f => !taken.has(f.value))
      .map(f => ({ label: f.label, value: f.value }));

    return {
      id:       resp.id,
      n:        name || fields[0]?.value || 'Unknown',
      e:        email,
      p:        phone,
      skills,
      rate,
      proof,
      notes,
      capacity,
      member,
      extra,
      since:    (resp.createdAt ?? resp.submittedAt ?? '').slice(0, 10),
      url:      `https://tally.so/forms/${TALENT_FORM}/submissions`,
    };
  });
}

async function fetchTally() {
  if (!TALLY_API_KEY) return null;

  let allQuestions: any[]  = [];
  let allResponses: any[]  = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.tally.so/forms/${TALENT_FORM}/submissions?page=${page}&limit=100`,
      { headers: { Authorization: `Bearer ${TALLY_API_KEY}` } }
    );
    if (!res.ok) break;
    const data = await res.json();

    // Tally's actual structure: { questions: [...], responses: [...] }
    if (page === 1) allQuestions = data.questions ?? [];

    const batch = data.responses ?? data.submissions ?? data.data ?? [];
    allResponses.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return { questions: allQuestions, responses: allResponses };
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const result = await fetchTally();

  if (result === null) {
    return new Response(JSON.stringify({ noKey: true, supply: [], demand: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const entries = parseResponses(result.questions, result.responses);

  return new Response(JSON.stringify({ noKey: false, supply: entries, demand: [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
