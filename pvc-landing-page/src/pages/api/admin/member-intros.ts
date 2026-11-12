export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN         = import.meta.env.NOTION_TOKEN ?? '';
const NOTION_MEMBERS_DB_ID = import.meta.env.NOTION_MEMBERS_DB_ID ?? 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';
const NOTION_CRM_DB_ID     = '872bd20eee31468f91bed1cd472e157a';
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
  what_you_bring: string;
  support_areas: string;
  pvc_goals: string;
  wants_from_room: string;
  introductions: string;
  goal_90_days: string;
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
        try {
          const blocks = await getPageBlocks(page.id);
          return {
            id: page.id,
            name,
            email,
            what_you_bring: getRichText(blocks, 'What they bring'),
            support_areas:  getRichText(blocks, 'Support areas'),
            pvc_goals:      getRichText(blocks, 'Looking for in PVC'),
            wants_from_room: getRichText(blocks, 'What they want from the room'),
            introductions:  getRichText(blocks, 'Intro target'),
            goal_90_days:   (page.properties['Goal (3 months)']?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
          } as MemberProfile;
        } catch {
          return { id: page.id, name, email, what_you_bring: '', support_areas: '', pvc_goals: '', wants_from_room: '', introductions: '', goal_90_days: '' } as MemberProfile;
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

    // 4. LLM matching — only if we have profiles and Anthropic key
    let pairs: { a: string; b: string; reason: string; draft: string }[] = [];

    console.log('[member-intros] profiles with data:', profiles.filter(p => p.what_you_bring || p.support_areas).length, '/', profiles.length, 'total. API key set:', !!ANTHROPIC_API_KEY);
    if (ANTHROPIC_API_KEY && profiles.length >= 2) {
      const profileSummaries = profiles.map(p =>
        `${p.name}:\n  Brings: ${p.what_you_bring || 'not specified'}\n  Needs support with: ${p.support_areas || 'not specified'}\n  Goals: ${p.pvc_goals || 'not specified'}\n  Wants from the room: ${p.wants_from_room || 'not specified'}\n  Intro request: ${p.introductions || 'not specified'}`
      ).join('\n\n');

      const prompt = `You are matching members of a private business owners community for introductions. Based on their onboarding profiles, suggest up to 5 member pairs who would genuinely benefit from being introduced.

Member profiles:
${profileSummaries}

Return a JSON array of up to 5 objects with these exact keys:
- "a": name of first member
- "b": name of second member
- "reason": 1-2 sentence explanation of why this pairing makes sense
- "draft": a WhatsApp intro message draft (3-4 sentences, warm and direct, as if from the community manager)

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
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (llmRes.ok) {
          const llmData = await llmRes.json();
          console.log('[member-intros] LLM response keys:', Object.keys(llmData), 'stop_reason:', llmData.stop_reason, 'content length:', llmData.content?.length, 'content[0] type:', llmData.content?.[0]?.type, 'text preview:', JSON.stringify(llmData.content?.[0]?.text ?? '').slice(0, 100));
          const rawText = llmData.content?.[0]?.text ?? '';
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
