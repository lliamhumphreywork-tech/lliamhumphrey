export const prerender = false;

import type { APIRoute } from 'astro';

const BREVO_API_KEY  = import.meta.env.BREVO_API_KEY;
const NOTION_TOKEN   = import.meta.env.NOTION_TOKEN;
const ADMIN_KEY      = import.meta.env.ADMIN_KEY;

// Brevo template ID for the approval / book-a-call email
const TEMPLATE_APPROVAL = 21;

// Notion DB ID (shared CRM)
const NOTION_DB_ID = '872bd20eee31468f91bed1cd472e157a';

async function getNotionPage(pageId: string) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
    },
  });
  if (!res.ok) throw new Error(`Notion fetch error ${res.status}`);
  return res.json();
}

async function sendApprovalEmail(email: string, firstName: string) {
  if (!BREVO_API_KEY) return;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      templateId: TEMPLATE_APPROVAL,
      to: [{ email, name: firstName }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo send error ${res.status}: ${err}`);
  }
}

export const POST: APIRoute = async ({ request }) => {
  // Secure this endpoint — Notion automations send a custom header
  const authHeader = request.headers.get('x-admin-key');
  if (!ADMIN_KEY || authHeader !== ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Notion automation sends the page ID and the new property value
  const pageId    = payload.page_id ?? payload.data?.page_id;
  const newStatus = payload.status ?? payload.data?.properties?.Status?.select?.name;

  if (!pageId) {
    return new Response('Missing page_id', { status: 400 });
  }

  // Only act on the "Approved - Call Email Sent" transition
  if (newStatus !== 'Approved - Call Email Sent') {
    return new Response('No action needed', { status: 200 });
  }

  try {
    const page = await getNotionPage(pageId);
    const props = page.properties ?? {};

    const emailProp = props.Email?.email ?? '';
    const nameParts = (props.Name?.title?.[0]?.text?.content ?? '').split(' ');
    const firstName = nameParts[0] ?? 'there';

    if (!emailProp) {
      console.error(`[notion-status-webhook] No email on page ${pageId}`);
      return new Response('No email found', { status: 422 });
    }

    await sendApprovalEmail(emailProp, firstName);
    console.log(`[notion-status-webhook] Approval email sent to ${emailProp}`);

    return new Response(JSON.stringify({ sent: true, email: emailProp }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[notion-status-webhook]', err.message);
    return new Response(err.message, { status: 500 });
  }
};
