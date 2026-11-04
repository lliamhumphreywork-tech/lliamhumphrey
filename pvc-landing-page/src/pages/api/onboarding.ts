export const prerender = false;
import type { APIRoute } from 'astro';
import { notionQuery, notionPatch, notionCreate, titleProp, textProp, selectProp, dateProp } from '../../lib/notion';
import { postWebhook } from '../../lib/slack';

const NOTION_MI_DB   = 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';
const NOTION_TOKEN   = import.meta.env.NOTION_TOKEN ?? '';
const SLACK_OPS_URL  = import.meta.env.SLACK_MEMBERS_URL ?? import.meta.env.SLACK_LEADS_URL ?? '';

function richText(content: string) {
  return [{ type: 'text', text: { content: content || '' } }];
}

function heading(text: string) {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: richText(text) },
  };
}

function paragraph(text: string) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: richText(text || 'Not provided') },
  };
}

async function appendBlocks(pageId: string, children: any[]) {
  if (!NOTION_TOKEN || !children.length) return;
  await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ children }),
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const {
    full_name, preferred_name, email, location, social,
    business_name, business_description, team_size,
    challenge, goal_90_days,
    pvc_goals, wants_from_room, support_areas, introductions,
    what_you_bring,
    interests_multi, interests_other, anything_else,
  } = body;

  if (!full_name || !email) {
    return new Response(JSON.stringify({ error: 'name and email required' }), { status: 400 });
  }

  const firstName = preferred_name || full_name.split(' ')[0];
  const today = new Date().toISOString().split('T')[0];

  // Find or create MI record
  let miPageId: string | null = null;
  try {
    const existing = await notionQuery(NOTION_MI_DB, {
      property: 'Member', title: { contains: full_name.split(' ')[0] },
    });
    if (existing.length) {
      miPageId = existing[0].id;
      await notionPatch(miPageId, {
        'Goal (3 months)':    textProp(goal_90_days ?? ''),
        'Current Bottleneck': textProp(challenge ?? ''),
        'Last Check-in':      dateProp(today),
      });
    } else {
      const created = await notionCreate(NOTION_MI_DB, {
        'Member':             titleProp(full_name),
        'Business':           textProp(business_name ?? ''),
        'Goal (3 months)':    textProp(goal_90_days ?? ''),
        'Current Bottleneck': textProp(challenge ?? ''),
        'Last Check-in':      dateProp(today),
        'Next Follow-up':     dateProp(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]),
      });
      miPageId = created?.id ?? null;
    }
  } catch (e: any) {
    console.error('[onboarding] MI DB write failed:', e.message);
  }

  // Append full form data as page blocks so it's readable in Notion
  if (miPageId) {
    const blocks: any[] = [
      heading(`Onboarding Form — ${today}`),
      heading('About'),
      paragraph(`Email: ${email}`),
      paragraph(`Preferred name: ${preferred_name || 'Not provided'}`),
      paragraph(`Location: ${location || 'Not provided'}`),
      paragraph(`Social: ${social || 'Not provided'}`),
      heading('Business'),
      paragraph(`${business_name || 'Not provided'}`),
      paragraph(business_description || 'Not provided'),
      paragraph(`Team size: ${team_size || 'Not provided'}`),
      heading('What they bring'),
      paragraph(what_you_bring || 'Not provided'),
      heading('Looking for in PVC'),
      paragraph(pvc_goals || 'Not provided'),
      paragraph(`What they want from the room: ${wants_from_room || 'Not provided'}`),
      heading('Support areas'),
      paragraph(support_areas || 'Not provided'),
      paragraph(`Intro target: ${introductions || 'Not provided'}`),
      heading('Beyond business'),
      paragraph(interests_multi || 'Not provided'),
      paragraph(`Other interests: ${interests_other || 'Not provided'}`),
      paragraph(`Other notes: ${anything_else || 'Not provided'}`),
    ];
    await appendBlocks(miPageId, blocks).catch(e =>
      console.error('[onboarding] Block append failed:', e.message)
    );
  }

  // Slack notification
  if (SLACK_OPS_URL) {
    const msg = [
      `*New Member Onboarding Form — ${full_name}* (${email})`,
      business_name ? `*Business:* ${business_name}` : '',
      `*Team:* ${team_size || 'Not specified'}`,
      `*Challenge:* ${challenge || 'Not provided'}`,
      `*90-day goal:* ${goal_90_days || 'Not provided'}`,
      `*Looking for:* ${pvc_goals || 'Not provided'}`,
      `*Support areas:* ${support_areas || 'Not provided'}`,
      `*Brings:* ${what_you_bring || 'Not provided'}`,
    ].filter(Boolean).join('\n');
    await postWebhook(SLACK_OPS_URL, msg).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
