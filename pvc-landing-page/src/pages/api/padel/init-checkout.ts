export const prerender = false;

import type { APIRoute } from 'astro';
import { notionQuery } from '../../../lib/notion';
import { PADEL, resolveTier, getPrice, getItemName } from '../../../lib/padel-config';

const PAYSTACK_SECRET = import.meta.env.PAYSTACK_SECRET_KEY ?? '';
const ALLOWED_ORIGIN  = 'https://privatevictoriesclub.com';

export const POST: APIRoute = async ({ request }) => {
  // Block checkout if any venue detail is still placeholder
  const missingDetail =
    !PADEL.ADDRESS || PADEL.ADDRESS.includes('TBC') ||
    !PADEL.RAIN_PLAN || PADEL.RAIN_PLAN.includes('TBC') ||
    !PADEL.LOUNGE_END || PADEL.LOUNGE_END.includes('TBC');
  if (missingDetail) {
    return err(503, 'Event details not yet confirmed. Sales temporarily paused.');
  }

  let body: any;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }

  const { name, email, playing, ticketType, utm_source, utm_medium, utm_campaign, utm_content } = body ?? {};

  if (!name || !email || !playing || !ticketType) return err(400, 'Missing required fields');
  if (!['Yes', 'No'].includes(playing))           return err(400, 'Invalid playing value');
  if (!['ga', 'member'].includes(ticketType))     return err(400, 'Invalid ticket type');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(400, 'Invalid email');

  // ── Cap check + tier resolution (soft — webhook enforces hard stop) ──
  let rows: any[] = [];
  try { rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID); } catch { /* non-fatal */ }

  // Exclude refunded rows from cap count
  const activeRows  = rows.filter((r: any) => !r.properties['Refunded']?.checkbox);
  const totalSold   = activeRows.length;
  const playersSold = activeRows.filter((r: any) => r.properties['Playing']?.select?.name === 'Yes').length;

  if (totalSold >= PADEL.TICKET_CAP) return err(409, 'Sold out — no spots left.');
  if (playing === 'Yes' && playersSold >= PADEL.PLAYER_CAP) {
    return err(409, 'Player spots are full. You can still join as social-only.');
  }

  const tier     = resolveTier(totalSold);
  const amount   = getPrice(tier, ticketType as 'ga' | 'member');
  const itemName = getItemName(tier, ticketType as 'ga' | 'member');
  const tierLabel = tier === 'early' ? 'Early Access' : 'Standard';
  const amountLabel = `R${(amount / 100).toFixed(0)}`;

  const callbackUrl = `${ALLOWED_ORIGIN}/padel-confirm`;

  const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount,
      currency: 'ZAR',
      callback_url: callbackUrl,
      metadata: {
        name,
        email,
        playing,
        ticket_type: ticketType,
        tier,
        item_name: itemName,
        utm_source: utm_source ?? null,
        utm_medium: utm_medium ?? null,
        utm_campaign: utm_campaign ?? null,
        utm_content: utm_content ?? null,
        custom_fields: [
          { display_name: 'Name',        variable_name: 'name',        value: name },
          { display_name: 'Playing?',    variable_name: 'playing',     value: playing === 'Yes' ? 'Yes, playing' : 'No, social only' },
          { display_name: 'Ticket',      variable_name: 'ticket_type', value: `${ticketType === 'member' ? 'PVC Member' : 'General Admission'} · ${tierLabel} · ${amountLabel}` },
        ],
      },
    }),
  });

  if (!psRes.ok) {
    const text = await psRes.text();
    console.error('[padel/init-checkout] Paystack error:', psRes.status, text.slice(0, 200));
    return err(502, 'Could not initialise checkout. Please try again.');
  }

  const psData = await psRes.json();
  if (!psData.data?.authorization_url) return err(502, 'No checkout URL from Paystack.');

  return new Response(JSON.stringify({ url: psData.data.authorization_url }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
}
