export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import { logContactAction } from '../../lib/notion-crm';

const BREVO_API_KEY = import.meta.env.BREVO_API_KEY;
const ADMIN_KEY = import.meta.env.ADMIN_KEY;

const CALENDLY = 'https://calendly.com/lliamhumphreywork/1hr';

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('x-admin-key');
  if (!ADMIN_KEY || authHeader !== ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { email, firstName } = body;
  if (!email || !firstName) {
    return new Response('Missing email or firstName', { status: 400 });
  }

  waitUntil(handleSend(email, firstName));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

async function handleSend(email: string, firstName: string) {
  await Promise.all([
    // Send the email
    fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Lliam', email: 'lliamhumphreywork@gmail.com' },
        to: [{ email, name: firstName }],
        subject: "Let's hop on a call",
        htmlContent: `<p>Hey ${firstName},</p><p>Thanks for filling out the form — appreciate you taking the time to actually share where you're at.</p><p>Based on what you shared, I'd like to hop on a quick call, 30 minutes, to understand your business a bit more and see if Private Victories is the right fit for you right now.</p><p>Here's my calendar, grab whatever time works:</p><p><a href="${CALENDLY}">${CALENDLY}</a></p><p>Talk soon,<br>Lliam</p>`,
      }),
    }),

    // Auto-log to Notion CRM
    logContactAction({
      email,
      status: 'Approved - Call Email Sent',
      interactionType: 'Email Sent',
      note: 'Call booking email sent',
    }),
  ]);

  console.log(`[send-call-email] Sent to ${email}, Notion updated`);
}
