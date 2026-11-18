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

  // ── Event details ──
  EVENT_DATE_UTC:      '2026-12-11T15:00:00Z', // 17:00 SAST
  EVENT_START_SAST:    '17:00',
  COURTS_END_SAST:     '18:30',          // padel play window: 17:00 – 18:30
  EVENT_END_SAST:      '21:30',          // published end time (lounge)
  VENUE_CLOSES:        '22:00',
  LOUNGE_END:          '21:30',          // used in email template as LOUNGE_END var
  VENUE:               'Discovery Padel Park, Johannesburg',
  ADDRESS:             'Discovery Padel Park, Cnr Rivonia & Bowling Ave, Sandton, 2196',
  RAIN_PLAN:           "If rain stops play, we'll decide by 14:00 on the day and tell you by email and Instagram. If we can't run the event, you get a full refund.",

  // Form closes 8 Dec 23:59 SAST = 8 Dec 21:59 UTC
  FORM_CLOSE_UTC: '2026-12-08T21:59:00Z',

  // Refund cutoff: 7 days before event = 4 Dec 17:00 SAST = 4 Dec 15:00 UTC
  REFUND_CUTOFF_UTC: '2026-12-04T15:00:00Z',

  // ── Court invoice constants (from Africa Padel invoice, 6 courts = R7,607.50) ──
  COURT_RATE_PER_HOUR:  434.78,  // per court per hour
  BALLS_COST_PER_COURT: 147.83,  // 1 ball per court
  RACKET_RATE_PER_HOUR: 43.48,   // per racket per hour (4 rackets per court)
  RACKETS_PER_COURT:    4,
  BOOKING_HOURS:        1.5,
  COURT_ADMIN_FEE:      250,
  VENUE_VAT:            0.15,

  // Brevo
  BREVO_LIST_PADEL:            24,  // attendees list
  BREVO_LIST_WAITLIST:         25,  // waitlist list
  BREVO_TEMPLATE_PADEL_CONFIRM: 63,
  BREVO_TEMPLATE_PADEL_REMINDER: 64,

  // Notion DBs
  NOTION_PADEL_DB_ID:          '41cb402f-dc12-81cb-a053-000b76179d44',
  // NOTION_PADEL_WAITLIST_DB_ID is loaded from env — create the DB in Notion then set this var

  // Paystack item names — used in webhook classifier
  ITEM_NAME_GA_EARLY:        'Padel Social GA Ticket (Early)',
  ITEM_NAME_MEMBER_EARLY:    'Padel Social Member Ticket (Early)',
  ITEM_NAME_GA_STANDARD:     'Padel Social GA Ticket',
  ITEM_NAME_MEMBER_STANDARD: 'Padel Social Member Ticket',

  // Refund policy copy (used on page and in confirmation email)
  REFUND_POLICY: 'Full refund up to 7 days before the event (by 4 December at 17:00). After that, tickets are non-refundable but you can transfer your spot. If we cancel or postpone, you get a full refund.',
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

/** Court invoice breakdown for N courts (1.5h booking). Returns line items + totals. */
export function courtInvoice(n: number): {
  courts: number; courtsCost: number; ballsCost: number; racketsCost: number;
  adminFee: number; subtotal: number; vat: number; total: number;
} {
  const courtsCost = n * PADEL.BOOKING_HOURS * PADEL.COURT_RATE_PER_HOUR;
  const ballsCost  = n * PADEL.BALLS_COST_PER_COURT;
  const racketsCost = n * PADEL.RACKETS_PER_COURT * PADEL.BOOKING_HOURS * PADEL.RACKET_RATE_PER_HOUR;
  const adminFee   = PADEL.COURT_ADMIN_FEE;
  const subtotal   = courtsCost + ballsCost + racketsCost + adminFee;
  const vat        = subtotal * PADEL.VENUE_VAT;
  const total      = subtotal + vat;
  return { courts: n, courtsCost, ballsCost, racketsCost, adminFee, subtotal, vat, total };
}

/** Current date string (YYYY-MM-DD) in Africa/Johannesburg timezone. */
export function dateSAST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Check if a refund is within the allowed window (before REFUND_CUTOFF_UTC). */
export function isRefundAllowed(now: Date = new Date()): boolean {
  return now < new Date(PADEL.REFUND_CUTOFF_UTC);
}

/** Build .ics calendar attachment for the padel event (base64 encoded). */
export function buildPadelIcs(): string {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PVC//Padel Social//EN',
    'BEGIN:VEVENT',
    'DTSTART;TZID=Africa/Johannesburg:20261211T170000',
    'DTEND;TZID=Africa/Johannesburg:20261211T213000',
    'SUMMARY:Founders\' Padel Social — PVC',
    `LOCATION:${PADEL.ADDRESS.replace(/,/g, '\\,')}`,
    'DESCRIPTION:Founders\' Padel Social hosted by Private Victories Club. Complete your profile form at the link in your confirmation email.',
    'UID:padel-social-2026@privatevictoriesclub.com',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return Buffer.from(ics).toString('base64');
}
