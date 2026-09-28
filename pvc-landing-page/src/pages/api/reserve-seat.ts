export const prerender = false;

import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DB_ID = '872bd20eee31468f91bed1cd472e157a';

async function findNotionPageByEmail(email: string): Promise<string | null> {
  const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: {
        property: 'Notes',
        rich_text: { contains: `Email: ${email}` },
      },
      page_size: 1,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion query error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const page = data.results?.[0];
  return page?.id ?? null;
}

async function updateNotionReservation(pageId: string, tier: string): Promise<void> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      properties: {
        Status: { select: { name: 'Reserved - Pending Review' } },
        'Last Interaction': { select: { name: 'Reserved' } },
        Type: { multi_select: [{ name: 'Dinner Applicant' }, { name: tier }] },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion update error ${res.status}: ${err}`);
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!NOTION_TOKEN) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }

  const { email, tier } = body;

  if (!email || !tier) {
    return new Response(JSON.stringify({ error: 'Missing email or tier' }), { status: 400 });
  }

  if (!['General Admission', 'VIP Admission'].includes(tier)) {
    return new Response(JSON.stringify({ error: 'Invalid tier' }), { status: 400 });
  }

  try {
    const pageId = await findNotionPageByEmail(email.trim().toLowerCase());

    if (!pageId) {
      // No existing application found — still log the reservation attempt but return success
      // so the user doesn't get a confusing error on a page they were redirected to
      console.warn(`[reserve-seat] No Notion entry found for email: ${email}`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    await updateNotionReservation(pageId, tier);

    console.log(`[reserve-seat] Reserved ${email} as ${tier} (page ${pageId})`);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    console.error('[reserve-seat] Error:', err.message);
    return new Response(JSON.stringify({ error: 'Could not update reservation. Please try again.' }), { status: 500 });
  }
};
