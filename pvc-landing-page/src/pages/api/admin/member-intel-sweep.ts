export const prerender = false;
import type { APIRoute } from 'astro';
import { notionQuery, getTitle, getText, getSelect, getDate } from '../../../lib/notion';
import { postWebhook } from '../../../lib/slack';

const ADMIN_KEY              = import.meta.env.ADMIN_KEY ?? '';
const SLACK_MEMBER_INTEL_URL = import.meta.env.SLACK_MEMBER_INTEL_URL ?? '';
const ANTHROPIC_API_KEY      = import.meta.env.ANTHROPIC_API_KEY;
const NOTION_MI_DB_ID        = 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';

const FOLLOW_UP_DUE_DAYS   = 3;   // flag if follow-up within 3 days
const CHECK_IN_STALE_DAYS  = 21;  // flag if no check-in in 21 days

interface MemberRecord {
  pageId:       string;
  name:         string;
  business:     string;
  goal:         string;
  bottleneck:   string;
  actionTaken:  string;
  result:       string;
  revenueStage: string;
  tier:         string;
  lastCheckIn:  string;
  nextFollowUp: string;
}

// Positive = future, negative = past
function daysFromToday(dateStr: string): number {
  if (!dateStr) return Infinity;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

async function fetchAllMembers(): Promise<MemberRecord[]> {
  const results = await notionQuery(NOTION_MI_DB_ID);
  return results
    .map(r => {
      const p = r.properties;
      return {
        pageId:       r.id,
        name:         getTitle(p, 'Member'),
        business:     getText(p, 'Business'),
        goal:         getText(p, 'Goal (3 months)'),
        bottleneck:   getText(p, 'Current Bottleneck'),
        actionTaken:  getText(p, 'Action Taken'),
        result:       getText(p, 'Result'),
        revenueStage: getSelect(p, 'Revenue Stage'),
        tier:         getSelect(p, 'Tier'),
        lastCheckIn:  getDate(p, 'Last Check-in'),
        nextFollowUp: getDate(p, 'Next Follow-up'),
      };
    })
    .filter(m => m.name);
}

async function draftCheckIn(member: MemberRecord, reason: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return '[API key missing — draft unavailable]';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `You are writing a WhatsApp check-in message from Lliam (founder of Private Victories Club, a high-performance business community in South Africa) to one of his members.

Write ONE short, warm, natural-sounding message (2-4 sentences). Sound like a genuine founder who cares about the person — not a customer service rep or a coach. Reference something specific from their context. No fluff. No emojis unless they feel natural.

Member: ${member.name}
Business: ${member.business}
3-month goal: ${member.goal}
Current bottleneck: ${member.bottleneck}
Last action taken: ${member.actionTaken}
Recent result: ${member.result}
Reason for check-in: ${reason}

Output ONLY the message text, nothing else.`,
        }],
      }),
    });
    if (!res.ok) { console.error(`[member-intel-sweep] Draft error ${res.status}`); return '[draft failed]'; }
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? '[draft empty]';
  } catch (e: any) {
    console.error('[member-intel-sweep] Draft error:', e.message);
    return '[draft error]';
  }
}

async function findConnectionOpportunities(members: MemberRecord[]): Promise<string> {
  if (!ANTHROPIC_API_KEY || members.length < 2) return '';
  try {
    const summaries = members.map(m =>
      `${m.name} | Business: ${m.business.slice(0, 120)} | Goal: ${m.goal.slice(0, 80)} | Bottleneck: ${m.bottleneck.slice(0, 80)}`
    ).join('\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `These are members of Private Victories Club. Find 1-2 strong connection opportunities where one member's specific need directly matches another's skill, service, or situation.

Members:
${summaries}

For each match, use exactly this format:
MATCH: [Name A] → [Name B]
WHY: [one sentence — the specific reason this is a strong match]
INTRO: [short message Lliam could send to introduce them, mentioning the specific overlap]

Only surface genuine, specific matches — not vague "they're both entrepreneurs" ones. If there are no strong matches, output: NO_MATCHES`,
        }],
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? '';
  } catch {
    return '';
  }
}

function formatMemberBlock(m: MemberRecord, flag: string, reason: string, draft: string): string {
  const daysTo = daysFromToday(m.nextFollowUp);
  const icon   = flag === 'overdue' ? '🔴' : flag === 'due_soon' ? '🟡' : '🔵';
  const label  = flag === 'overdue' ? 'Missed follow-up' : flag === 'due_soon' ? 'Follow-up due soon' : 'Check-in needed';
  const followUpLine = m.nextFollowUp
    ? `*Follow-up:* ${m.nextFollowUp}${daysTo < 0 ? ` _(${Math.abs(daysTo)}d overdue)_` : daysTo === 0 ? ' _(today)_' : ` _(in ${daysTo}d)_`}`
    : '';

  return [
    `${icon} *${label}: ${m.name}*`,
    `*Tier:* ${m.tier} · *Revenue stage:* ${m.revenueStage}`,
    `*Business:* ${m.business.slice(0, 140)}`,
    `*Goal:* ${m.goal.slice(0, 120)}`,
    `*Bottleneck:* ${m.bottleneck.slice(0, 100)}`,
    m.lastCheckIn ? `*Last check-in:* ${m.lastCheckIn}` : '',
    followUpLine,
    ``,
    `*Draft WhatsApp message:*`,
    `_${draft}_`,
  ].filter(Boolean).join('\n');
}

function formatConnections(raw: string): string {
  if (!raw || raw === 'NO_MATCHES') return '';
  const lines = raw.split('\n').filter(Boolean);
  const formatted = lines.map(l => {
    if (l.startsWith('MATCH:'))  return `\n🔗 *${l.replace('MATCH:', '').trim()}*`;
    if (l.startsWith('WHY:'))    return `_${l.replace('WHY:', '').trim()}_`;
    if (l.startsWith('INTRO:'))  return `*Intro draft:*\n_${l.replace('INTRO:', '').trim()}_`;
    return l;
  }).join('\n');
  return `*Connection Opportunities*\n${formatted}`;
}

export const POST: APIRoute = async ({ request }) => {
  const isCron  = request.headers.get('x-vercel-cron') === '1';
  const isAdmin = ADMIN_KEY && request.headers.get('x-admin-key') === ADMIN_KEY;
  if (!isCron && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let members: MemberRecord[];
  try {
    members = await fetchAllMembers();
  } catch (e: any) {
    console.error('[member-intel-sweep] Failed to fetch members:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  if (!members.length) {
    return new Response(JSON.stringify({ ok: true, flagged: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Determine flags — one flag per member (highest priority wins)
  const flagged: { member: MemberRecord; flag: string; reason: string }[] = [];
  for (const m of members) {
    const daysToFollowUp   = daysFromToday(m.nextFollowUp);
    const daysSinceCheckIn = m.lastCheckIn ? -daysFromToday(m.lastCheckIn) : Infinity;

    if (m.nextFollowUp && daysToFollowUp < 0) {
      flagged.push({ member: m, flag: 'overdue', reason: `Follow-up was due ${Math.abs(daysToFollowUp)}d ago (${m.nextFollowUp})` });
    } else if (m.nextFollowUp && daysToFollowUp <= FOLLOW_UP_DUE_DAYS) {
      flagged.push({ member: m, flag: 'due_soon', reason: `Follow-up due in ${daysToFollowUp}d (${m.nextFollowUp})` });
    } else if (daysSinceCheckIn >= CHECK_IN_STALE_DAYS) {
      flagged.push({ member: m, flag: 'stale', reason: `No check-in for ${Math.round(daysSinceCheckIn)} days` });
    }
  }

  // Draft messages + find connections in parallel
  const [drafts, connections] = await Promise.all([
    Promise.all(flagged.map(f => draftCheckIn(f.member, f.reason))),
    findConnectionOpportunities(members),
  ]);

  // Post header if there's anything to say
  const hasConnections = connections && connections !== 'NO_MATCHES';
  if (flagged.length || hasConnections) {
    await postWebhook(SLACK_MEMBER_INTEL_URL, `*Member Intelligence Sweep*  ·  ${new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}`);
  }

  // Post each flagged member
  for (let i = 0; i < flagged.length; i++) {
    await postWebhook(SLACK_MEMBER_INTEL_URL, formatMemberBlock(flagged[i].member, flagged[i].flag, flagged[i].reason, drafts[i]));
  }

  // Post connections
  if (hasConnections) {
    const formatted = formatConnections(connections);
    if (formatted) await postWebhook(SLACK_MEMBER_INTEL_URL, formatted);
  }

  // All clear message
  if (!flagged.length && !hasConnections) {
    await postWebhook(SLACK_MEMBER_INTEL_URL, `✅ *Member sweep complete* — no follow-ups due, no overdue check-ins, no new connection matches. All good.`);
  }

  console.log(`[member-intel-sweep] Done — flagged: ${flagged.length}, connections: ${hasConnections ? 'yes' : 'none'}`);
  return new Response(JSON.stringify({ ok: true, flagged: flagged.length }), { headers: { 'Content-Type': 'application/json' } });
};

export const GET: APIRoute = async ({ request }) => POST({ request } as any);
