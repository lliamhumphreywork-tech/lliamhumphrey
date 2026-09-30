export const prerender = false;
import type { APIRoute } from 'astro';

const TALLY_API_KEY = import.meta.env.TALLY_API_KEY;
const TALENT_FORM   = 'dWJdNz';
const ADMIN_KEY     = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

function getLabel(f: any): string {
  // Tally may use label, question, or title depending on field type
  return (f.label ?? f.question ?? f.title ?? '').toLowerCase();
}

function matchLabel(f: any, keywords: string[]) {
  const l = getLabel(f);
  return keywords.some(k => l.includes(k));
}

function fieldValue(f: any): string {
  if (!f) return '';
  if (Array.isArray(f.value)) return f.value.join(', ');
  return String(f.value ?? '');
}

function parseSubmissions(submissions: any[]) {
  return submissions.map((sub: any) => {
    const fields: any[] = sub.fields ?? [];
    const get = (keywords: string[]) => {
      const f = fields.find((f: any) => matchLabel(f, keywords));
      return fieldValue(f);
    };

    // Exact Tally form field labels for dWJdNz
    const name   = get(['full name', 'name']);
    const email  = get(['email']);
    const phone  = get(['whatsapp', 'phone', 'number', 'contact']);
    const skills = get(['what do you do', 'skill', 'service', 'offer', 'expertise']);
    const proof  = get(['portfolio', 'proof of work', 'link only']);
    const notes  = get(['tell us about a recent client', 'recent client', 'outcome', 'tell us', 'about']);
    const rate   = get(['rate/pricing', 'rate', 'pricing', 'budget', 'price', 'fee']);
    const capacity = get(['how many clients', 'capacity', 'realistically take']);
    const member = get(['private victories member', 'currently a', 'pvc member']);

    const used = new Set([name, email, phone, skills, proof, notes, rate, capacity, member].filter(Boolean));
    const extra = fields
      .filter((f: any) => {
        const v = fieldValue(f);
        return v && !used.has(v) && f.type !== 'HIDDEN_FIELDS' && f.type !== 'CALCULATED_FIELDS';
      })
      .map((f: any) => ({ label: f.label ?? f.question ?? '', value: fieldValue(f) }));

    // fallback: first non-empty field if name still empty
    const firstText = !name ? (() => {
      const f = fields.find((f: any) => {
        const v = fieldValue(f);
        return v && f.type !== 'HIDDEN_FIELDS' && f.type !== 'CALCULATED_FIELDS';
      });
      return fieldValue(f);
    })() : '';

    return {
      id:     sub.id,
      n:      name || firstText || 'Unknown',
      e:      email,
      p:      phone,
      skills,
      rate,
      proof,
      notes,
      capacity,
      member,
      extra,
      since:  sub.createdAt?.slice(0, 10) ?? '',
      url:    `https://tally.so/forms/${TALENT_FORM}/submissions`,
    };
  });
}

async function fetchTallySubmissions() {
  if (!TALLY_API_KEY) return null;

  const all: any[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.tally.so/forms/${TALENT_FORM}/submissions?page=${page}&limit=100`,
      { headers: { Authorization: `Bearer ${TALLY_API_KEY}` } }
    );
    if (!res.ok) break;
    const data = await res.json();
    const subs = data.submissions ?? data.data ?? [];
    all.push(...subs);
    if (subs.length < 100) break;
    page++;
  }
  return all;
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const rawSubs = await fetchTallySubmissions();

  if (rawSubs === null) {
    return new Response(JSON.stringify({
      noKey: true,
      supply: [],
      demand: [],
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const entries = parseSubmissions(rawSubs);

  return new Response(JSON.stringify({
    noKey: false,
    supply: entries,
    demand: [],
  }), { headers: { 'Content-Type': 'application/json' } });
};
