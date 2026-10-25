export const prerender = false;
import type { APIRoute } from 'astro';
import { notionPatch, selectProp } from '../../../lib/notion';
import { sendTemplate } from '../../../lib/brevo';

const ADMIN_KEY = import.meta.env.ADMIN_KEY;

const TEMPLATE_ACCEPTED = 49;
const TEMPLATE_REJECTED = 50;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function updateNotionStatus(pageId: string, status: 'Accepted' | 'Rejected') {
  await notionPatch(pageId, { Status: selectProp(status) });
}

async function sendDecisionEmail(email: string, firstName: string, decision: 'accept' | 'reject') {
  const templateId = decision === 'accept' ? TEMPLATE_ACCEPTED : TEMPLATE_REJECTED;
  await sendTemplate(templateId, { email, name: firstName }).catch((e: any) => {
    console.error(`[decision] Brevo error:`, e.message);
  });
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
