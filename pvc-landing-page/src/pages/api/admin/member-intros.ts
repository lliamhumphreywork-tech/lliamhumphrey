export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN         = import.meta.env.NOTION_TOKEN ?? '';
const NOTION_MEMBERS_DB_ID = import.meta.env.NOTION_MEMBERS_DB_ID ?? 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';
const NOTION_CRM_DB_ID     = '872bd20eee31468f91bed1cd472e157a';
const NOTION_INTROS_DB_ID  = '1b79aa5765af471582f672445e05173b';
const ADMIN_KEY            = import.meta.env.ADMIN_KEY ?? '';
const ANTHROPIC_API_KEY    = import.meta.env.ANTHROPIC_API_KEY ?? '';

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function notionGet(url: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
    },
  });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return res.json();
}

async function queryDB(dbId: string, filter?: any): Promise<any[]> {
  const body: any = { page_size: 100 };
  if (filter) body.filter = filter;
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion query ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

async function getPageBlocks(pageId: string): Promise<any[]> {
  const data = await notionGet(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`);
  return data.results ?? [];
}

function getTitle(page: any) {
  const p = page.properties;
  for (const key of ['Member', 'Name', 'Full Name']) {
    const v = p[key]?.title?.map((t: any) => t.plain_text).join('');
    if (v) return v;
  }
  return '';
}

function getEmail(page: any) {
  const p = page.properties;
  for (const key of ['Email', 'email']) {
    if (p[key]?.email) return p[key].email;
    const v = p[key]?.rich_text?.map((t: any) => t.plain_text).join('');
    if (v) return v;
  }
  return '';
}

function getRichText(blocks: any[], heading: string): string {
  let found = false;
  for (const block of blocks) {
    if (block.type === 'heading_3') {
      const text = (block.heading_3?.rich_text ?? []).map((t: any) => t.plain_text).join('');
      found = text.toLowerCase().includes(heading.toLowerCase());
      continue;
    }
    if (found && block.type === 'paragraph') {
      return (block.paragraph?.rich_text ?? []).map((t: any) => t.plain_text).join('');
    }
    if (found && block.type === 'heading_3') break;
  }
  return '';
}

interface MemberProfile {
  id: string;
  name: string;
  email: string;
  // onboarding form blocks
  what_you_bring: string;
  support_areas: string;
  pvc_goals: string;
  wants_from_room: string;
  introductions: string;
  // Notion MI DB properties (live intel)
  goal_90_days: string;
  current_bottleneck: string;
  connection_made: string;
  action_taken: string;
  tier: string;
  revenue_stage: string;
  business: string;
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });
  if (!NOTION_TOKEN) return new Response(JSON.stringify({ error: 'NOTION_TOKEN not set' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  try {
    // 1. Fetch all MI DB pages
    const miPages = await queryDB(NOTION_MEMBERS_DB_ID);

    // 2. For each page, fetch blocks and parse onboarding data
    const profiles: MemberProfile[] = await Promise.all(
      miPages.map(async (page: any) => {
        const name = getTitle(page);
        const email = getEmail(page);
        if (!name) return null;
        const props = page.properties;
        const goal90      = (props['Goal (3 months)']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
        const bottleneck  = (props['Current Bottleneck']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
        const connMade    = (props['Connection Made']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
        const actionTaken = (props['Action Taken']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
        const tier        = props['Tier']?.select?.name ?? '';
        const revStage    = props['Revenue Stage']?.select?.name ?? '';
        const business    = (props['Business']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
        try {
          const blocks = await getPageBlocks(page.id);
          return {
            id: page.id,
            name,
            email,
            what_you_bring:  getRichText(blocks, 'What they bring'),
            support_areas:   getRichText(blocks, 'Support areas'),
            pvc_goals:       getRichText(blocks, 'Looking for in PVC'),
            wants_from_room: getRichText(blocks, 'What they want from the room'),
            introductions:   getRichText(blocks, 'Intro target'),
            goal_90_days:    goal90,
            current_bottleneck: bottleneck,
            connection_made:    connMade,
            action_taken:       actionTaken,
            tier,
            revenue_stage:  revStage,
            business,
          } as MemberProfile;
        } catch {
          return { id: page.id, name, email, what_you_bring: '', support_areas: '', pvc_goals: '', wants_from_room: '', introductions: '', goal_90_days: goal90, current_bottleneck: bottleneck, connection_made: connMade, action_taken: actionTaken, tier, revenue_stage: revStage, business } as MemberProfile;
        }
      })
    ).then(ps => ps.filter(Boolean) as MemberProfile[]);

    // 3. Cross-check: CRM "Member" contacts vs MI DB
    const crmMembers = await queryDB(NOTION_CRM_DB_ID, {
      property: 'Status',
      select: { equals: 'Member' },
    });
    const miEmails = new Set(profiles.map(p => p.email.toLowerCase()).filter(Boolean));
    const crossCheck = crmMembers
      .map((page: any) => {
        const p = page.properties;
        const name = (p['Name']?.title ?? p['Full Name']?.title ?? []).map((t: any) => t.plain_text).join('');
        const email = p['Email']?.email ?? (p['Email']?.rich_text ?? []).map((t: any) => t.plain_text).join('');
        return { name, email };
      })
      .filter(c => c.email && !miEmails.has(c.email.toLowerCase()));

    // 4. Fetch already-sent intro pairs to avoid re-suggesting them
    let sentPairs: string[] = [];
    try {
      const sentPages = await queryDB(NOTION_INTROS_DB_ID, {
        property: 'Status',
        select: { equals: 'Sent' },
      });
      sentPairs = sentPages.map((page: any) => {
        const p = page.properties;
        const a = (p['Member A']?.rich_text ?? []).map((t: any) => t.plain_text).join('').trim();
        const b = (p['Member B']?.rich_text ?? []).map((t: any) => t.plain_text).join('').trim();
        return a && b ? `${a} ↔ ${b}` : '';
      }).filter(Boolean);
    } catch {
      // non-fatal — just suggest freely if we can't fetch history
    }

    // 5. LLM matching — only if we have profiles and Anthropic key
    let pairs: { a: string; b: string; need_offer: string; why_now: string; risk: string; confidence: string; ask_a: string; ask_b: string }[] = [];

    console.log('[member-intros] profiles with data:', profiles.filter(p => p.what_you_bring || p.support_areas).length, '/', profiles.length, 'total. API key set:', !!ANTHROPIC_API_KEY);
    if (ANTHROPIC_API_KEY && profiles.length >= 2) {
      const profileSummaries = profiles.map(p => {
        const lines = [`${p.name} (${p.business || 'business not listed'}):`];
        if (p.what_you_bring)      lines.push(`  FORM — Brings: ${p.what_you_bring}`);
        if (p.support_areas)       lines.push(`  FORM — Needs support with: ${p.support_areas}`);
        if (p.pvc_goals)           lines.push(`  FORM — Goals in PVC: ${p.pvc_goals}`);
        if (p.wants_from_room)     lines.push(`  FORM — Wants from the room: ${p.wants_from_room}`);
        if (p.introductions)       lines.push(`  FORM — Intro request: ${p.introductions}`);
        if (p.goal_90_days)        lines.push(`  NOTION — Goal (3 months): ${p.goal_90_days}`);
        if (p.current_bottleneck)  lines.push(`  NOTION — Current bottleneck: ${p.current_bottleneck}`);
        if (p.connection_made)     lines.push(`  NOTION — Connection made: ${p.connection_made}`);
        if (p.action_taken)        lines.push(`  NOTION — Action taken: ${p.action_taken}`);
        return lines.join('\n');
      }).join('\n\n');

      const alreadySentSection = sentPairs.length
        ? `\nPairs already formally introduced (do NOT suggest these again):\n${sentPairs.map(p => `- ${p}`).join('\n')}\n`
        : '';

      const prompt = `You are generating member introduction suggestions for Private Victories Club, a private community of business owners.

You have TWO sources of data for each member:
1. FORM data: what they wrote in their onboarding form (what they bring, what they need, goals)
2. NOTION data: live intel from the Member Intelligence database (current bottleneck, 90-day goal, connections already made, actions already taken)

RULES (follow strictly):
1. Every suggestion must quote one specific NEED from one member and one specific OFFER from the other. If you can't quote both from the data above, do not suggest the pair.
2. Skip any pair where one member's "Connection made" or "Action taken" already mentions the other person's name.
3. Cap at 1 intro suggestion per member (max 2 for Sean, max 1 for Daniel Bouwer). If a member appears in several possible pairs, pick only their strongest match.
4. Never invent or exaggerate. Only use what is written in FORM or NOTION data. Mark anything unclear as "unverified".
5. Watch for name confusion — if two people could be mixed up (e.g. similar names), flag it.
6. Flag possible conflicts: competitors in the same niche, or someone in transition/low capacity.
7. Never include revenue figures, revenue ranges, or tier information in any message.
8. Do not write a "send" message. Write a PRIVATE ASK for each member (2-3 sentences, one specific reason, an easy out like "no pressure, just say if not").
${alreadySentSection}
Member profiles:
${profileSummaries}

Return a JSON array of up to 5 objects with these exact keys:
- "a": name of first member
- "b": name of second member
- "need_offer": one sentence — "[A] needs X / [B] offers Y" quoting from their data
- "why_now": one sentence on timing or relevance
- "risk": any conflict, name confusion, or capacity flag (empty string if none)
- "confidence": "high", "medium", or "low"
- "ask_a": private WhatsApp ask to send member A first (2-3 sentences, specific reason, easy out)
- "ask_b": private WhatsApp ask to send member B first (2-3 sentences, specific reason, easy out)

Return ONLY valid JSON, no markdown fences.`;

      try {
        const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-5-5',
            max_tokens: 4096,
            thinking: { type: 'disabled' },
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          // Find the text block — may be after a thinking block in extended thinking mode
          const textBlock = (llmData.content ?? []).find((b: any) => b.type === 'text');
          const rawText = textBlock?.text ?? '';
          // Strip markdown fences if present
          const text = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
          try {
            pairs = JSON.parse(text);
            if (!Array.isArray(pairs)) pairs = [];
          } catch {
            console.error('[member-intros] JSON parse failed, raw text:', rawText.slice(0, 300));
            pairs = [];
          }
        } else {
          const errText = await llmRes.text();
          console.error('[member-intros] LLM non-ok:', llmRes.status, errText.slice(0, 300));
        }
      } catch (e: any) {
        console.error('[member-intros] LLM call failed:', e.message);
      }
    }

    return new Response(JSON.stringify({ pairs, crossCheck }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[member-intros] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
