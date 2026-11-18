// All tunable values for the Dec 2026 Padel Social in one place.
// Change these without touching any other file.

export const PADEL = {
  TICKET_CAP:    40,   // total spots
  PLAYER_CAP:    28,   // "Yes, I'll play" cap

  // ── Two-tier pricing (amounts in kobo / cents) ──
  EARLY_CAP:            15,              // early access closes after this many tickets sold…
  EARLY_CUTOFF_UTC:     '2026-11-27T21:59:00Z', // …or at 27 Nov 23:59 SAST (UTC+2 → 21:59 UTC)
  PRICE_EARLY_GA:       40000,           // R400 early public
  PRICE_EARLY_MEMBER:   20000,           // R200 early PVC member (50 % off)
  PRICE_STANDARD_GA:    50000,           // R500 standard public
  PRICE_STANDARD_MEMBER: 25000,          // R250 standard PVC member (50 % off)
  MEMBER_DISCOUNT_PCT:  50,              // kept for display — always 50 % off public tier

  // ── Break-even ──
  BREAK_EVEN:         23,                // guests to cover venue cost (shown in admin)
  BREAK_EVEN_COST:    'R7,607.50',       // venue cost for display

  // ISO string in Africa/Johannesburg = UTC+2 → subtract 2h for UTC
  EVENT_DATE_UTC: '2026-12-11T15:00:00Z', // 17:00 SAST
  VENUE:         'Discovery Padel Park, Johannesburg',
  LOUNGE_END:    '21:00',                 // placeholder until confirmed

  // Form closes 8 Dec 23:59 SAST = 9 Dec 21:59 UTC
  FORM_CLOSE_UTC: '2026-12-09T21:59:00Z',

  // Brevo
  BREVO_LIST_PADEL: 24,              // new list for this event
  BREVO_TEMPLATE_PADEL_CONFIRM: 32,  // new template (created separately)

  // Notion DB for tickets
  NOTION_PADEL_DB_ID: '41cb402f-dc12-81cb-a053-000b76179d44',

  // Paystack item names — used in webhook classifier
  ITEM_NAME_GA_EARLY:      'Padel Social GA Ticket (Early)',
  ITEM_NAME_MEMBER_EARLY:  'Padel Social Member Ticket (Early)',
  ITEM_NAME_GA_STANDARD:   'Padel Social GA Ticket',
  ITEM_NAME_MEMBER_STANDARD: 'Padel Social Member Ticket',

  // Refund policy copy (used on page and in confirmation email)
  REFUND_POLICY: 'Full refund up to 7 days before the event. After that, tickets are non-refundable but you can transfer your spot. If we cancel or postpone, you get a full refund.',
} as const;

/** Resolve the current pricing tier. Pure — pass a `now` for testability. */
export function resolveTier(totalSold: number, now: Date = new Date()): 'early' | 'standard' {
  const cutoff = new Date(PADEL.EARLY_CUTOFF_UTC);
  if (totalSold < PADEL.EARLY_CAP && now < cutoff) return 'early';
  return 'standard';
}

/** Get the ticket price in kobo for a given tier + ticket type. */
export function getPrice(tier: 'early' | 'standard', ticketType: 'ga' | 'member'): number {
  if (tier === 'early') {
    return ticketType === 'member' ? PADEL.PRICE_EARLY_MEMBER : PADEL.PRICE_EARLY_GA;
  }
  return ticketType === 'member' ? PADEL.PRICE_STANDARD_MEMBER : PADEL.PRICE_STANDARD_GA;
}

/** Get the item name for a Paystack transaction. */
export function getItemName(tier: 'early' | 'standard', ticketType: 'ga' | 'member'): string {
  if (tier === 'early') {
    return ticketType === 'member' ? PADEL.ITEM_NAME_MEMBER_EARLY : PADEL.ITEM_NAME_GA_EARLY;
  }
  return ticketType === 'member' ? PADEL.ITEM_NAME_MEMBER_STANDARD : PADEL.ITEM_NAME_GA_STANDARD;
}
