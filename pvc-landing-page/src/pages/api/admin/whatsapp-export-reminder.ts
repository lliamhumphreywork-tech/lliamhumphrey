export const prerender = false;
import type { APIRoute } from 'astro';
import { postWebhook } from '../../../lib/slack';

const SLACK_FINANCE_URL = import.meta.env.SLACK_FINANCE_URL ?? '';
const ADMIN_KEY         = import.meta.env.ADMIN_KEY ?? '';

export const POST: APIRoute = async ({ request }) => {
  const isCron  = request.headers.get('x-vercel-cron') === '1';
  const isAdmin = ADMIN_KEY && request.headers.get('x-admin-key') === ADMIN_KEY;
  if (!isCron && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  await postWebhook(
    SLACK_FINANCE_URL,
    `📱 *Weekly reminder: export the PVC WhatsApp group chat*\n\nOpen WhatsApp → PVC group → ⋮ → More → Export chat (without media) → share the .txt with Claude to update Member Intelligence.\n\nTakes 2 minutes. Keeps the member records current.`,
  );

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};

export const GET: APIRoute = async ({ request }) => POST({ request } as any);
