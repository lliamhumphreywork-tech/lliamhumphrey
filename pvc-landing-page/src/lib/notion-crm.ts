const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DB_ID = '872bd20eee31468f91bed1cd472e157a';

const HEADERS = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
};

export type InteractionType =
  | 'Email Sent'
  | 'Call'
  | 'IG DM'
  | 'WhatsApp'
  | 'Voice Note'
  | 'Met IRL'
  | 'Other';

export type CRMStatus =
  | 'Applied'
  | 'Pending Review'
  | 'Approved - Call Email Sent'
  | 'Call Booked'
  | 'Discovery Call Booked'
  | 'Qualified'
  | 'Highest Room Track'
  | 'Deposit Paid'
  | 'Member'
  | 'Founding Member'
  | 'Membership Activated'
  | 'Free Community Funnel'
  | 'Contacted';

// Map interaction type to CRM "Last Interaction" select value
const INTERACTION_TO_LAST: Record<InteractionType, string> = {
  'Email Sent':  'Call',
  'Call':        'Call',
  'IG DM':       'DM on Instagram',
  'WhatsApp':    'Sent WhatsApp',
  'Voice Note':  'Voice Note',
  'Met IRL':     'Met IRL',
  'Other':       'Call',
};

export async function findContactByEmail(email: string): Promise<string | null> {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      filter: { property: 'Email', email: { equals: email } },
      page_size: 1,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0]?.id ?? null;
}

export async function updateContactStatus(
  pageId: string,
  status: CRMStatus,
  lastInteraction?: InteractionType
) {
  const props: Record<string, any> = {
    Status: { select: { name: status } },
  };

  if (lastInteraction) {
    props['Last Interaction'] = { select: { name: INTERACTION_TO_LAST[lastInteraction] } };
  }

  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({ properties: props }),
  });
}

export async function appendInteraction(
  pageId: string,
  type: InteractionType,
  note: string
) {
  const timestamp = new Date().toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const line = `${timestamp} · ${type}: ${note}`;

  await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: line } }],
            color: 'default',
          },
        },
      ],
    }),
  });
}

// Combined: find by email, update status, append log — call this from any send/action
export async function logContactAction(opts: {
  email: string;
  status?: CRMStatus;
  interactionType: InteractionType;
  note: string;
}) {
  const pageId = await findContactByEmail(opts.email);
  if (!pageId) return null;

  await Promise.all([
    opts.status
      ? updateContactStatus(pageId, opts.status, opts.interactionType)
      : updateContactStatus(pageId, 'Contacted' as CRMStatus, opts.interactionType),
    appendInteraction(pageId, opts.interactionType, opts.note),
  ]);

  return pageId;
}
