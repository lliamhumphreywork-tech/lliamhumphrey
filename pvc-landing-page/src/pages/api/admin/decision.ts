export const prerender = false;
import type { APIRoute } from 'astro';
import { notionPatch, selectProp, dateProp, numProp } from '../../../lib/notion';
import { sendTemplate } from '../../../lib/brevo';

const ADMIN_KEY    = import.meta.env.ADMIN_KEY ?? '';
const BREVO_KEY    = import.meta.env.BREVO_API_KEY ?? '';
const CAL_URL      = import.meta.env.PVC_APPLICATION_CALL_URL ?? 'https://cal.com/lliam-humphrey-q82xct/pvcapplicationcall';
const TEMPLATE_REJECTED = 50;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

function approvalHtml(name: string): string {
  return [
    `<p>Hey ${name},</p>`,
    `<p>I went through your application and I think there's a fit here.</p>`,
    `<p>Next step is a call with me, about 30 to 45 minutes. You'll ask what you want, I'll ask what I need, and if it's a match we get you locked in and onboarded on the call.</p>`,
    `<p>Pick a time that works: <a href="${CAL_URL}">Book my call</a></p>`,
    `<p>Can't find a slot? Just reply or WhatsApp me and I'll make one work.</p>`,
    `<p>Lliam</p>`,
  ].join('');
}

async function sendApprovalEmail(email: string, firstName: string): Promise<void> {
  if (!BREVO_KEY) return;
  const name    = firstName.trim() || 'there';
  const subject = firstName.trim() ? `${firstName.trim()}, let's talk` : "Let's talk";
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender:      { name: 'Lliam', email: 'lliamhumphreywork@gmail.com' },
      to:          [{ email, name }],
      subject,
      htmlContent: approvalHtml(name),
    }),
  });
  if (!res.ok) throw new Error(`Brevo send error ${res.status}: ${await res.text()}`);
}

async function sendRejectionEmail(email: string, firstName: string): Promise<void> {
  const name = firstName.trim() || 'there';
  await sendTemplate(TEMPLATE_REJECTED, { email, name }, { firstName: name }).catch((e: any) => {
    console.error('[decision] Brevo rejection error:', e.message);
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

  try {
    if (decision === 'accept') {
      if (!email) return new Response('Missing email for accept', { status: 400 });
      const today = new Date().toISOString().split('T')[0];
      await Promise.all([
        sendApprovalEmail(email, firstName ?? ''),
        notionPatch(pageId, {
          Status:               selectProp('Accepted'),
          'Booking Email Sent': dateProp(today),
          'Follow-up Count':    numProp(0),
        }),
      ]);
      console.log(`[decision] Accepted ${email}, booking email sent`);
    } else {
      await notionPatch(pageId, { Status: selectProp('Rejected') });
      if (email) await sendRejectionEmail(email, firstName ?? '');
      console.log(`[decision] Rejected ${email ?? pageId}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[decision] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
