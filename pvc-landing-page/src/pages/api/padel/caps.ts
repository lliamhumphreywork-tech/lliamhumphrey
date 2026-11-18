export const prerender = false;

import type { APIRoute } from 'astro';
import { notionQuery } from '../../../lib/notion';
import { PADEL } from '../../../lib/padel-config';

export const GET: APIRoute = async () => {
  try {
    const rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID);
    const total   = rows.length;
    const players = rows.filter(r => r.properties['Playing']?.select?.name === 'Yes').length;
    return new Response(JSON.stringify({
      total,
      players,
      totalCap:  PADEL.TICKET_CAP,
      playerCap: PADEL.PLAYER_CAP,
      totalFull:  total  >= PADEL.TICKET_CAP,
      playerFull: players >= PADEL.PLAYER_CAP,
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    // Fail open — page still works, caps just won't show
    return new Response(JSON.stringify({ total: 0, players: 0, totalCap: PADEL.TICKET_CAP, playerCap: PADEL.PLAYER_CAP, totalFull: false, playerFull: false }), { status: 200 });
  }
};
