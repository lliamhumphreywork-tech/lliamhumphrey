export const prerender = false;

import type { APIRoute } from 'astro';
import crypto from 'crypto';
import { notionQuery, notionPatch, textProp, selectProp, multiProp, checkProp, dateProp } from '../../../lib/notion';
import { PADEL } from '../../../lib/padel-config';

const MAGIC_LINK_SECRET = import.meta.env.MAGIC_LINK_SECRET ?? '';

function verifyToken(token: string, paymentId: string, email: string): boolean {
  if (!MAGIC_LINK_SECRET || !token || !paymentId || !email) return false;
  const expected = crypto.createHmac('sha256', MAGIC_LINK_SECRET).update(`${paymentId}:${email}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }

  const { token, ref, name, business, description, stage, workingOn, whoToMeet, offer, consent } = body ?? {};

  if (!token || !ref) return err(400, 'Missing token or ref');

  // Form close check
  if (new Date() > new Date(PADEL.FORM_CLOSE_UTC)) {
    return err(410, 'The profile form is now closed. Thank you for submitting!');
  }

  // Load ticket from Notion (need email to verify token)
  let rows: any[];
  try {
    rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID, {
      property: 'Payment ID', rich_text: { equals: ref },
    });
  } catch (e: any) {
    console.error('[padel/profile-form] Notion query failed:', e.message);
    return err(502, 'Could not load your ticket. Please try again.');
  }

  if (!rows.length) return err(404, 'Ticket not found.');

  const row   = rows[0];
  const email = row.properties['Email']?.email ?? '';

  if (!verifyToken(token, ref, email)) return err(403, 'Invalid token.');

  // Validation
  if (!name?.trim())        return err(400, 'Name is required.');
  if (!business?.trim())    return err(400, 'Business name is required.');
  if (!description?.trim()) return err(400, 'Business description is required.');
  if (!stage)               return err(400, 'Stage is required.');
  if (!consent)             return err(400, 'POPIA consent is required to save your profile.');

  const whoArr: string[] = Array.isArray(whoToMeet) ? whoToMeet.slice(0, 2) : [];

  try {
    await notionPatch(row.id, {
      'Name':                 { title: [{ text: { content: name.trim() } }] },
      'Business':             textProp(business.trim()),
      'Business Description': textProp(description.trim()),
      'Stage':                selectProp(stage),
      'Working On':           textProp(workingOn?.trim() ?? ''),
      'Who to Meet':          multiProp(whoArr),
      'Offer':                textProp(offer?.trim() ?? ''),
      'Consent':              checkProp(true),
      'Consent At':           dateProp(new Date().toISOString().split('T')[0]),
      'Form Completed':       checkProp(true),
    });
  } catch (e: any) {
    console.error('[padel/profile-form] Notion patch failed:', e.message);
    return err(502, 'Could not save your profile. Please try again.');
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
}
