export const prerender = false;

import type { APIRoute } from 'astro';
import { notionCreate, titleProp, emailProp, dateProp } from '../../../lib/notion';
import { enrollContact } from '../../../lib/brevo';
import { PADEL } from '../../../lib/padel-config';

const NOTION_WAITLIST_DB_ID = import.meta.env.NOTION_PADEL_WAITLIST_DB_ID ?? '';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }

  const { email, name } = body ?? {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(400, 'Valid email required');

  const addedAt = new Date().toISOString().split('T')[0];

  // Store in Notion waitlist DB (if configured)
  if (NOTION_WAITLIST_DB_ID) {
    try {
      await notionCreate(NOTION_WAITLIST_DB_ID, {
        'Name':     titleProp(name ?? email),
        'Email':    emailProp(email),
        'Added At': dateProp(addedAt),
      });
    } catch (e: any) {
      console.error('[padel/waitlist] Notion error:', e.message);
    }
  }

  // Enrol in Brevo waitlist list
  try {
    await enrollContact(email, {
      FIRSTNAME: (name ?? email).split(' ')[0],
    }, [PADEL.BREVO_LIST_WAITLIST]);
  } catch (e: any) {
    console.error('[padel/waitlist] Brevo error:', e.message);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
}
