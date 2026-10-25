export const prerender = false;
import type { APIRoute } from 'astro';
import { notionQuery, getTitle, getText, getSelect } from '../../../lib/notion';
import { postWebhook } from '../../../lib/slack';

const NOTION_CRM_DB     = '872bd20eee31468f91bed1cd472e157a';
const NOTION_MEMBERS_DB = import.meta.env.NOTION_MEMBERS_DB_ID ?? 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';
const SLACK_FINANCE_URL = import.meta.env.SLACK_FINANCE_URL ?? '';
const ADMIN_KEY         = import.meta.env.ADMIN_KEY ?? '';

const RENEWAL_WINDOW_DAYS   = 30;
const CHECKIN_OVERDUE_DAYS  = 60;
const MEMBERSHIP_DAYS       = 120;
const ACCEPTED_STALE_DAYS   = 5;

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

// 1. New applications this week (CRM, Pending Review, last 7 days)
async function getNewApplications(today: Date) {
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 7);
  const pages  = await notionQuery(NOTION_CRM_DB, {
    and: [
      { property: 'Status', select: { equals: 'Pending Review' } },
      { property: 'Submission Date', date: { on_or_after: cutoff.toISOString().split('T')[0] } },
    ],
  });
  return pages.map((pg: any) => {
    const p = pg.properties;
    return {
      name:    getTitle(p, 'Name'),
      revenue: getText(p, 'Monthly Revenue') || getSelect(p, 'Revenue Stage'),
      score:   p['Application Score']?.number ?? null,
      type:    (p['Type']?.multi_select ?? []).map((t: any) => t.name).join(', '),
    };
  });
}

// 2. Pending decisions: Accepted status, no payment for 5+ days
async function getPendingDecisions(today: Date) {
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - ACCEPTED_STALE_DAYS);
  const pages  = await notionQuery(NOTION_CRM_DB, {
    and: [
      { property: 'Status', select: { equals: 'Accepted' } },
      { property: 'Submission Date', date: { on_or_before: cutoff.toISOString().split('T')[0] } },
    ],
  });
  return pages.map((pg: any) => {
    const p = pg.properties;
    const submitted = p['Submission Date']?.date?.start ?? '';
    const daysWaiting = submitted ? daysBetween(new Date(submitted), today) : 0;
    return {
      name:        getTitle(p, 'Name'),
      email:       p['Email']?.email ?? '',
      daysWaiting,
      submitted,
    };
  });
}

// 3. Renewal watch: Members DB, since + 120 days within next 30 days
async function getRenewalWatch(today: Date) {
  const pages = await notionQuery(NOTION_MEMBERS_DB, {
    property: 'Status', select: { equals: 'Active' },
  });
  const watch: any[] = [];
  for (const pg of pages) {
    const p     = pg.properties;
    const since = p['Member Since']?.date?.start ?? p['Date']?.date?.start ?? '';
    if (!since) continue;
    const sinceDate  = new Date(since); sinceDate.setHours(0, 0, 0, 0);
    const renewal    = new Date(sinceDate.getTime() + MEMBERSHIP_DAYS * 86400000);
    const daysLeft   = daysBetween(today, renewal);
    if (daysLeft >= 0 && daysLeft <= RENEWAL_WINDOW_DAYS) {
      watch.push({
        name:     getTitle(p, 'Member') || getTitle(p, 'Name') || getTitle(p, 'Full Name'),
        tier:     getSelect(p, 'Tier') || getSelect(p, 'Ticket'),
        renewal:  renewal.toISOString().split('T')[0],
        daysLeft,
      });
    }
  }
  return watch.sort((a, b) => a.daysLeft - b.daysLeft);
}

// 4. At-risk members: active, no check-in for 60+ days
async function getAtRisk(today: Date) {
  const pages = await notionQuery(NOTION_MEMBERS_DB, {
    property: 'Status', select: { equals: 'Active' },
  });
  const atRisk: any[] = [];
  for (const pg of pages) {
    const p       = pg.properties;
    const checkin = p['Last Check-in']?.date?.start ?? '';
    const since   = p['Member Since']?.date?.start ?? pg.created_time?.slice(0, 10) ?? '';
    const name    = getTitle(p, 'Member') || getTitle(p, 'Name') || getTitle(p, 'Full Name');
    if (checkin) {
      const last      = new Date(checkin); last.setHours(0, 0, 0, 0);
      const daysSince = daysBetween(last, today);
      if (daysSince >= CHECKIN_OVERDUE_DAYS) {
        atRisk.push({ name, tier: getSelect(p, 'Tier') || getSelect(p, 'Ticket'), daysSince, lastCheckin: checkin });
      }
    } else if (since) {
      const sinceDate = new Date(since); sinceDate.setHours(0, 0, 0, 0);
      const daysIn    = daysBetween(sinceDate, today);
      if (daysIn >= CHECKIN_OVERDUE_DAYS) {
        atRisk.push({ name, tier: getSelect(p, 'Tier') || getSelect(p, 'Ticket'), daysSince: daysIn, lastCheckin: 'never' });
      }
    }
  }
  return atRisk.sort((a, b) => b.daysSince - a.daysSince);
}

// 5. Derive the single priority action
function derivePriority(apps: any[], pending: any[], renewals: any[], atRisk: any[]): string {
  const tierAApps   = apps.filter(a => a.score !== null && a.score >= 5);
  const urgentRenew = renewals.filter(r => r.daysLeft <= 7);
  if (tierAApps.length)   return `Review ${tierAApps.length} Tier A application${tierAApps.length > 1 ? 's' : ''} — ${tierAApps.map(a => a.name).join(', ')}`;
  if (pending.length)     return `Follow up with ${pending[0].name} — accepted ${pending[0].daysWaiting} days ago, no payment yet`;
  if (urgentRenew.length) return `Reach out to ${urgentRenew[0].name} — membership expires in ${urgentRenew[0].daysLeft} day${urgentRenew[0].daysLeft === 1 ? '' : 's'}`;
  if (atRisk.length)      return `Check in with ${atRisk[0].name} — ${atRisk[0].daysSince} days since last check-in`;
  if (renewals.length)    return `Renewal coming: ${renewals[0].name} in ${renewals[0].daysLeft} days — prep renewal prompt`;
  return 'All clear — clean slate today.';
}

async function run() {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [apps, pending, renewals, atRisk] = await Promise.all([
    getNewApplications(today).catch(e => { console.error('[brief] apps error:', e.message); return []; }),
    getPendingDecisions(today).catch(e => { console.error('[brief] pending error:', e.message); return []; }),
    getRenewalWatch(today).catch(e => { console.error('[brief] renewals error:', e.message); return []; }),
    getAtRisk(today).catch(e => { console.error('[brief] atRisk error:', e.message); return []; }),
  ]);

  const priority = derivePriority(apps, pending, renewals, atRisk);

  const dateStr = today.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' });
  const lines: string[] = [];
  lines.push(`📊 *PVC Morning Brief — ${dateStr}*`);

  if (apps.length) {
    const tierA = apps.filter((a: any) => a.score !== null && a.score >= 5);
    lines.push('');
    lines.push(`📥 *New Applications (${apps.length}):*`);
    for (const a of apps) {
      const scoreLabel = a.score !== null ? ` · ${a.score}/10` : '';
      const flag = a.score !== null && a.score >= 5 ? ' 🔥' : '';
      lines.push(`• ${a.name}${scoreLabel}${flag}${a.revenue ? ` — ${a.revenue}` : ''}`);
    }
    if (tierA.length) lines.push(`_${tierA.length} Tier A applicant${tierA.length > 1 ? 's' : ''} awaiting review_`);
  }

  if (pending.length) {
    lines.push('');
    lines.push(`⏸ *Pending Decisions — Accepted, No Payment:*`);
    for (const p of pending) lines.push(`• ${p.name} — ${p.daysWaiting} days waiting`);
  }

  if (renewals.length) {
    lines.push('');
    lines.push(`🔄 *Renewals Due (next ${RENEWAL_WINDOW_DAYS} days):*`);
    for (const r of renewals) {
      const urg = r.daysLeft <= 3 ? '🔴' : r.daysLeft <= 7 ? '🟡' : '🟢';
      lines.push(`${urg} ${r.name}${r.tier ? ` — ${r.tier}` : ''} · ${r.daysLeft}d`);
    }
  }

  if (atRisk.length) {
    lines.push('');
    lines.push(`📭 *At-Risk Members (${CHECKIN_OVERDUE_DAYS}+ days no check-in):*`);
    for (const m of atRisk) lines.push(`• ${m.name} — ${m.daysSince}d (last: ${m.lastCheckin})`);
  }

  lines.push('');
  lines.push(`🎯 *Priority Today:* ${priority}`);

  if (!apps.length && !pending.length && !renewals.length && !atRisk.length) {
    lines.push('\n✅ Clean slate — nothing needs attention today.');
  }

  await postWebhook(SLACK_FINANCE_URL, lines.join('\n')).catch(() => {});

  return { apps, pending, renewals, atRisk, priority };
}

export const POST: APIRoute = async ({ request }) => {
  const isCron  = request.headers.get('x-vercel-cron') === '1';
  const isAdmin = ADMIN_KEY && request.headers.get('x-admin-key') === ADMIN_KEY;
  if (!isCron && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const result = await run();
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[members-morning-brief] Error:', e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const GET: APIRoute = async ({ request }) => {
  return POST({ request } as any);
};
