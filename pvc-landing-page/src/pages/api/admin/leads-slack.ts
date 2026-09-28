export const prerender = false;
import type { APIRoute } from 'astro';
import { put, head, del } from '@vercel/blob';

const ADMIN_KEY     = import.meta.env.ADMIN_KEY ?? '';
const SLACK_TOKEN   = import.meta.env.SLACK_BOT_TOKEN ?? '';
const LEADS_CHANNEL = import.meta.env.SLACK_LEADS_CHANNEL ?? '';

const REACTION_STATUS: Record<string, string> = {
  calling:               'Contacted',
  telephone_receiver:    'Contacted',
  phone:                 'Contacted',
  speech_balloon:        '2nd Touch',
  alarm_clock:           'Timing Issue',
  hourglass_flowing_sand:'Timing Issue',
  // clock emoji variants Slack uses (clock1 - clock12, clock130 - clock1230)
  clock1:                'Timing Issue', clock2:  'Timing Issue', clock3:  'Timing Issue',
  clock4:                'Timing Issue', clock5:  'Timing Issue', clock6:  'Timing Issue',
  clock7:                'Timing Issue', clock8:  'Timing Issue', clock9:  'Timing Issue',
  clock10:               'Timing Issue', clock11: 'Timing Issue', clock12: 'Timing Issue',
  clock130:              'Timing Issue', clock230:'Timing Issue', clock330:'Timing Issue',
  clock430:              'Timing Issue', clock530:'Timing Issue', clock630:'Timing Issue',
  clock730:              'Timing Issue', clock830:'Timing Issue', clock930:'Timing Issue',
  clock1030:             'Timing Issue', clock1130:'Timing Issue',clock1230:'Timing Issue',
  white_check_mark:      'Link Sent',
  ballot_box_with_check: 'Link Sent',
  moneybag:              'Paid',
  x:                     'Declined',
  no_entry_sign:         'Declined',
  no_entry:              'Declined',
};

// Higher number = wins when multiple reactions are present
const STATUS_PRIORITY: Record<string, number> = {
  'Paid': 6, 'Declined': 5, 'Timing Issue': 4,
  'Link Sent': 3, '2nd Touch': 2, 'Contacted': 1, 'New': 0,
};

const TERMINAL   = new Set(['Declined', 'Paid', 'Timing Issue']);
const CACHE_PATH = 'leads/reaction-cache.json';

type CacheEntry = { status: string; lastChangedAt: string };
type Cache      = Record<string, CacheEntry>;

async function loadCache(): Promise<Cache> {
  try {
    const info = await head(CACHE_PATH).catch(() => null);
    if (!info) return {};
    const res = await fetch(info.url);
    return await res.json();
  } catch { return {}; }
}

async function saveCache(cache: Cache): Promise<void> {
  try {
    await put(CACHE_PATH, JSON.stringify(cache), {
      access: 'public', addRandomSuffix: false, contentType: 'application/json',
    });
  } catch { /* non-fatal */ }
}

function getStatus(reactions: any[]): string {
  if (!reactions?.length) return 'New';
  let best = 'New';
  for (const r of reactions) {
    const s = REACTION_STATUS[r.name];
    if (s && (STATUS_PRIORITY[s] ?? 0) > (STATUS_PRIORITY[best] ?? 0)) {
      best = s;
    }
  }
  return best;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function parseLeadMessage(text: string): {
  name: string; email: string; tier: string;
  ticket: string; score: number; business: string; revenue: string;
  isCommunityLead: boolean;
} | null {
  if (!text.includes('New Event Lead')) return null;

  const tierMatch = text.match(/[··]\s*(Hot|Warm|Cold)\*?/i);
  if (!tierMatch) return null;

  const scoreMatch = text.match(/Score\s+(\d+)\/30/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

  const nameMatch = text.match(/\n\*([^*\n]+?)\*\s*(?:—|–|—|-)/);
  if (!nameMatch) return null;
  const name = nameMatch[1].trim();

  const emailMatch = text.match(/<mailto:([^|>]+)\|/);
  const email = emailMatch ? emailMatch[1].trim() : '';

  const ticketMatch = text.match(/\*Ticket:\*\s*([^\n··*]+)/);
  const ticket = ticketMatch ? ticketMatch[1].trim() : '';

  const bizMatch = text.match(/\*Business:\*\s*([^\n]+)/);
  const business = bizMatch ? bizMatch[1].trim() : '';

  const revenueMatch = text.match(/\*Revenue:\*\s*([^\n··*]+)/);
  const revenue = revenueMatch ? revenueMatch[1].trim() : '';
  const isCommunityLead = revenue === 'R0 - R10,000';

  return { name, email, tier: tierMatch[1], ticket, score, business, revenue, isCommunityLead };
}

// Cadence per spec:
// New:        flag for first contact immediately
// Contacted / 2nd Touch / Link Sent:
//   3+ days since last status change: follow-up due
//   6+ days since last status change: switch channel
// Paid / Declined / Timing Issue: no action
function calcAction(status: string, daysSinceChange: number): {
  action: 'none' | 'contact' | 'follow_up' | 'switch_channel';
  dueToday: boolean;
  overdue: boolean;
} {
  if (TERMINAL.has(status)) return { action: 'none', dueToday: false, overdue: false };

  if (status === 'New') {
    return { action: 'contact', dueToday: true, overdue: daysSinceChange > 1 };
  }

  if (['Contacted', '2nd Touch', 'Link Sent'].includes(status)) {
    if (daysSinceChange >= 6) {
      return { action: 'switch_channel', dueToday: true, overdue: daysSinceChange > 7 };
    }
    if (daysSinceChange >= 3) {
      return { action: 'follow_up', dueToday: true, overdue: daysSinceChange > 4 };
    }
    return { action: 'none', dueToday: false, overdue: false };
  }

  return { action: 'none', dueToday: false, overdue: false };
}

export async function fetchLeads(): Promise<{ configured: boolean; leads: any[]; error?: string }> {
  if (!SLACK_TOKEN || !LEADS_CHANNEL) return { configured: false, leads: [] };

  try {
    const oldest = String(Math.floor((Date.now() - 60 * 86400000) / 1000));
    const histRes = await fetch(
      `https://slack.com/api/conversations.history?channel=${encodeURIComponent(LEADS_CHANNEL)}&oldest=${oldest}&limit=200`,
      { headers: { Authorization: `Bearer ${SLACK_TOKEN}` } }
    );
    const hist = await histRes.json();

    if (!hist.ok) {
      return { configured: true, error: `Slack error: ${hist.error}`, leads: [] };
    }

    const cache = await loadCache();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let cacheUpdated = false;

    const leads = (hist.messages || [])
      .map((msg: any) => {
        const parsed = parseLeadMessage(msg.text || '');
        if (!parsed) return null;

        const reactions: any[] = msg.reactions || [];
        const status = getStatus(reactions);
        const leadDate = new Date(parseFloat(msg.ts) * 1000);
        leadDate.setHours(0, 0, 0, 0);
        const ts = msg.ts;

        // Update cache if status changed
        const cached = cache[ts];
        if (!cached || cached.status !== status) {
          cache[ts] = { status, lastChangedAt: new Date().toISOString() };
          cacheUpdated = true;
        }

        const lastChangedAt = new Date(cache[ts]?.lastChangedAt ?? leadDate.toISOString());
        lastChangedAt.setHours(0, 0, 0, 0);
        const daysSinceChange = daysBetween(lastChangedAt, today);
        const daysSinceLead   = daysBetween(leadDate, today);

        const cadence = parsed.isCommunityLead
          ? { action: 'none' as const, dueToday: false, overdue: false }
          : calcAction(status, status === 'New' ? daysSinceLead : daysSinceChange);

        return {
          id:              ts,
          name:            parsed.name,
          email:           parsed.email,
          ticket:          parsed.ticket,
          business:        parsed.business,
          revenue:         parsed.revenue,
          score:           parsed.score,
          tier:            parsed.tier,
          isCommunityLead: parsed.isCommunityLead,
          status,
          initialDate:     leadDate.toISOString(),
          daysSinceLead,
          daysSinceChange,
          action:          cadence.action,
          dueToday:        cadence.dueToday,
          overdue:         cadence.overdue,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        // overdue first, then due today, then by days (most urgent first)
        if (a.overdue   !== b.overdue)   return Number(b.overdue)   - Number(a.overdue);
        if (a.dueToday  !== b.dueToday)  return Number(b.dueToday)  - Number(a.dueToday);
        return b.daysSinceChange - a.daysSinceChange;
      });

    if (cacheUpdated) {
      saveCache(cache); // non-blocking
    }

    return { configured: true, leads };
  } catch (err: any) {
    return { configured: true, error: err.message, leads: [] };
  }
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (!ADMIN_KEY || request.headers.get('x-admin-key') !== ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await fetchLeads();
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
};
