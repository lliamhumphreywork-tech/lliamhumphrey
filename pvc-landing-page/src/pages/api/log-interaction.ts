export const prerender = false;

import type { APIRoute } from 'astro';
import { logContactAction, type InteractionType, type CRMStatus } from '../../lib/notion-crm';

const ADMIN_KEY = import.meta.env.ADMIN_KEY;

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

  const { email, type, note, status } = body;
  if (!email || !type || !note) {
    return new Response('Missing email, type, or note', { status: 400 });
  }

  const pageId = await logContactAction({
    email,
    interactionType: type as InteractionType,
    note,
    status: status as CRMStatus | undefined,
  });

  if (!pageId) {
    return new Response(JSON.stringify({ ok: false, reason: 'Contact not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, pageId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
