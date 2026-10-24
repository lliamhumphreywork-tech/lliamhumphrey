export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const ADMIN_KEY    = import.meta.env.ADMIN_KEY;
const BREVO_API_KEY = import.meta.env.BREVO_API_KEY;

// Set these once the Brevo templates are created
const TEMPLATE_ACCEPTED = parseInt(import.meta.env.BREVO_TEMPLATE_ACCEPTED ?? '0');
const TEMPLATE_REJECTED = parseInt(import.meta.env.BREVO_TEMPLATE_REJECTED ?? '0');

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function updateNotionStatus(pageId: string, status: 'Accepted' | 'Rejected') {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      properties: {
        Status: { select: { name: status } },
      },
    }),
  });
  if (!res.ok) throw new Error(`Notion error ${res.status}: ${await res.text()}`);
}

async function sendDecisionEmail(email: string, firstName: string, decision: 'accept' | 'reject') {
  if (!BREVO_API_KEY) return;
  const templateId = decision === 'accept' ? TEMPLATE_ACCEPTED : TEMPLATE_REJECTED;
  if (!templateId) return;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, to: [{ email, name: firstName }] }),
  });
  if (!res.ok) console.error(`[decision] Brevo error ${res.status}: ${await res.text()}`);
}

export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  let body: any;
  try { body = await request.json(); } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { pageId, decision, email, firstName } = body;
  if (!pageId || !decision || !['accept', 'reject'].includes(decision)) {
    return new Response('Missing pageId or decision', { status: 400 });
  }

  const PAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{32}$/i;
  if (!PAGE_ID_RE.test(pageId)) return new Response('Invalid pageId', { status: 400 });

  const notionStatus = decision === 'accept' ? 'Accepted' : 'Rejected';

  try {
    await updateNotionStatus(pageId, notionStatus);
    if (email && firstName) {
      await sendDecisionEmail(email, firstName, decision);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[decision] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
