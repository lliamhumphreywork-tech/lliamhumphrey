export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN  = import.meta.env.NOTION_TOKEN;
const SUPPLY_DB     = '770e8282-037c-4405-bdea-1eb41023cd42';
const DEMAND_DB     = 'fe06d735-b2cb-414e-b078-8acac2f7e92f';
const COMBINED_DB   = 'a15042d4-172c-4ba8-94d2-40544a7438e3';
const ADMIN_KEY     = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function queryDB(dbId: string) {
  const results: any[] = [];
  let cursor: string | undefined;
  do {
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) break;
    const data = await res.json();
    results.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

function parsePage(page: any, defaultKind: string) {
  const p = page.properties;
  const getText  = (k: string) => (p[k]?.rich_text ?? []).map((t: any) => t.plain_text).join('');
  const getTitle = (k: string) => (p[k]?.title     ?? []).map((t: any) => t.plain_text).join('');
  const getSelect = (k: string) => p[k]?.select?.name ?? '';

  const entryType = getSelect('Entry Type').toLowerCase();
  const kind = entryType.includes('demand') ? 'demand'
             : entryType.includes('supply') || entryType.includes('talent') ? 'supply'
             : defaultKind;

  const skill = getSelect('Skill/Category') || getText('Skill/Category') || getSelect('Role') || '';
  const proof = getText('Proof/Portfolio or Request Details') || getText('Proof/Portfolio') || getText('Description');
  const rate  = getText('Rate/Budget');

  return {
    id:     page.id,
    kind,
    n:      getTitle('Name') || getTitle('Full Name'),
    skill,
    rate,
    proof,
    notes:  getText('Notes'),
    contact: getText('Contact'),
    status: getSelect('Status'),
    member: !!(p['PVC Member?']?.checkbox),
    url:    page.url,
  };
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const [supplyPages, demandPages, combinedPages] = await Promise.all([
    queryDB(SUPPLY_DB),
    queryDB(DEMAND_DB),
    queryDB(COMBINED_DB),
  ]);

  const all = [
    ...supplyPages.map(p => parsePage(p, 'supply')),
    ...demandPages.map(p => parsePage(p, 'demand')),
    ...combinedPages.map(p => parsePage(p, 'supply')),
  ];

  const seen = new Set<string>();
  const deduped = all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });

  return new Response(JSON.stringify({
    supply: deduped.filter(e => e.kind === 'supply'),
    demand: deduped.filter(e => e.kind === 'demand'),
  }), { headers: { 'Content-Type': 'application/json' } });
};
