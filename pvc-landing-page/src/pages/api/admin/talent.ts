export const prerender = false;
import type { APIRoute } from 'astro';

const TALLY_API_KEY = import.meta.env.TALLY_API_KEY;
const TALENT_FORM   = 'dWJdNz';
const ADMIN_KEY     = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

function matchLabel(label: string, keywords: string[]) {
  const l = label.toLowerCase();
  return keywords.some(k => l.includes(k));
}

function parseSubmissions(submissions: any[]) {
  return submissions.map((sub: any) => {
    const fields: any[] = sub.fields ?? [];
    const get = (keywords: string[]) => {
      const f = fields.find((f: any) => matchLabel(f.label ?? '', keywords));
      if (!f) return '';
      if (Array.isArray(f.value)) return f.value.join(', ');
      return String(f.value ?? '');
    };

    const name    = get(['name', 'full name', 'your name', 'first name', 'surname', 'who are you', 'introduce']);
    const email   = get(['email']);
    const phone   = get(['phone', 'whatsapp', 'number', 'contact']);
    const ig      = get(['instagram', 'ig ', '@']);
    const skills  = get(['skill', 'service', 'offer', 'what do you do', 'expertise', 'speciali']);
    const rate    = get(['rate', 'budget', 'price', 'cost', 'charge', 'fee']);
    const proof   = get(['portfolio', 'proof', 'link', 'website', 'work', 'example']);
    const notes   = get(['note', 'additional', 'about', 'describe', 'tell us', 'anything else']);

    // collect remaining non-empty fields not already captured
    const used = new Set([name, email, phone, ig, skills, rate, proof, notes].filter(Boolean));
    const extra = fields
      .filter((f: any) => {
        const v = Array.isArray(f.value) ? f.value.join(', ') : String(f.value ?? '');
        return v && !used.has(v) && f.type !== 'HIDDEN_FIELDS';
      })
      .map((f: any) => {
        const v = Array.isArray(f.value) ? f.value.join(', ') : String(f.value ?? '');
        return { label: f.label ?? '', value: v };
      });

    // fallback: first non-empty text field if no name keyword matched
    const firstText = !name ? (() => {
      const f = fields.find((f: any) => {
        const v = Array.isArray(f.value) ? f.value.join(', ') : String(f.value ?? '');
        return v && f.type !== 'HIDDEN_FIELDS' && f.type !== 'CALCULATED_FIELDS';
      });
      if (!f) return '';
      return Array.isArray(f.value) ? f.value.join(', ') : String(f.value ?? '');
    })() : '';

    return {
      id:     sub.id,
      n:      name || firstText || 'Unknown',
      e:      email,
      p:      phone,
      ig,
      skills,
      rate,
      proof,
      notes,
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
