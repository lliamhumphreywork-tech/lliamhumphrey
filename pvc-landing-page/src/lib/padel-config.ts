// All tunable values for the Dec 2026 Padel Social in one place.
// Change these without touching any other file.

export const PADEL = {
  TICKET_CAP:    40,   // total spots
  PLAYER_CAP:    28,   // "Yes, I'll play" cap
  PRICE_GA:      40000, // rands in kobo (R400.00)
  PRICE_MEMBER:  35000, // rands in kobo (R350.00)
  BREAK_EVEN:    21,   // guests needed to cover 6-court cost (shown in admin)

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

  // Paystack item name — used in webhook classifier
  ITEM_NAME_GA:     'Padel Social GA Ticket',
  ITEM_NAME_MEMBER: 'Padel Social Member Ticket',

  // Refund policy copy
  REFUND_POLICY: 'Full refund if you cancel more than 48 hours before the event (before 17:00 on 9 Dec). Spot is transferable to another founder at any time. Full refund if PVC cancels.',
} as const;
