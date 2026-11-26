export const prerender = false;

import type { APIRoute } from 'astro';
import { notionQuery } from '../../../lib/notion';
import { PADEL, resolveTier, getPrice } from '../../../lib/padel-config';

export const GET: APIRoute = async () => {
  // Block sales if any venue detail is still placeholder
  const missingDetail =
    !PADEL.ADDRESS || PADEL.ADDRESS.includes('TBC') ||
    !PADEL.RAIN_PLAN || PADEL.RAIN_PLAN.includes('TBC') ||
    !PADEL.LOUNGE_END || PADEL.LOUNGE_END.includes('TBC');
  if (missingDetail) {
    return new Response(JSON.stringify({ blocked: true, reason: 'Event details not yet confirmed' }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }

  try {
    const rows = await notionQuery(PADEL.NOTION_PADEL_DB_ID);
    const activeRows = rows.filter((r: any) => !r.properties['Refunded']?.checkbox);
    const total   = activeRows.length;
    const players = activeRows.filter((r: any) => r.properties['Playing']?.select?.name === 'Yes').length;

    const tier          = resolveTier(total);
    const earlyRemaining = Math.max(0, PADEL.EARLY_CAP - total);
    const cutoffDate    = new Date(PADEL.EARLY_CUTOFF_UTC);
    const cutoffDisplay = cutoffDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });

    return new Response(JSON.stringify({
      total,
      players,
      totalCap:    PADEL.TICKET_CAP,
      playerCap:   PADEL.PLAYER_CAP,
      totalFull:   total  >= PADEL.TICKET_CAP,
      playerFull:  players >= PADEL.PLAYER_CAP,
      blocked:     false,
      // Tier info
      tier,
      earlyRemaining,
      earlyCap:    PADEL.EARLY_CAP,
      earlyCutoff: cutoffDisplay,         // e.g. "27 Nov"
      gaPrice:     getPrice(tier, 'ga') / 100,
      memberPrice: getPrice(tier, 'member') / 100,
      nextGaPrice: tier === 'early' ? PADEL.PRICE_STANDARD_GA / 100 : null,
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    // Fail open — page still works, caps just won't show
    return new Response(JSON.stringify({
      total: 0, players: 0, totalCap: PADEL.TICKET_CAP, playerCap: PADEL.PLAYER_CAP,
      totalFull: false, playerFull: false,
      tier: 'early', earlyRemaining: PADEL.EARLY_CAP, earlyCap: PADEL.EARLY_CAP,
      earlyCutoff: '1 Dec', gaPrice: PADEL.PRICE_EARLY_GA / 100, memberPrice: PADEL.PRICE_EARLY_MEMBER / 100,
      nextGaPrice: PADEL.PRICE_STANDARD_GA / 100,
    }), { status: 200 });
  }
};
