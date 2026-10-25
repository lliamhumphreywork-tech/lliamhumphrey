export const prerender = false;
import type { APIRoute } from 'astro';
import { getEvents, formatEventTime, isConfigured as calendarConfigured } from '../../../lib/google-calendar';
import { notionQuery, notionCreate, notionPatch, getTitle, getText, getSelect, getDate, titleProp, textProp, selectProp } from '../../../lib/notion';
import { postMessage } from '../../../lib/slack-bot';

const ADMIN_KEY          = import.meta.env.ADMIN_KEY ?? '';
const LLIAM_SLACK_ID     = import.meta.env.BARBARA_SLACK_USER_ID ?? '';   // Lliam's Slack user ID (UXXXXXXX)
const BARBARA_TASKS_DB   = import.meta.env.BARBARA_TASKS_DB_ID ?? '';    // Notion DB for Barbara's tasks
const NOTION_CRM_DB      = '872bd20eee31468f91bed1cd472e157a';
const SAST_OFFSET        = 2;  // UTC+2 (SAST, no DST)

function toSAST(d: Date): Date {
  return new Date(d.getTime() + SAST_OFFSET * 3600000);
}

function dateLabel(isoDate: string, today: Date): string {
  const d = new Date(isoDate.slice(0, 10));
  const t = new Date(today.toISOString().slice(0, 10));
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Calendar ──────────────────────────────────────────────────────────────────

async function buildCalendarSection(now: Date): Promise<string> {
  if (!calendarConfigured()) {
    return '_Reply with what your day looks like and I\'ll keep it in mind._';
  }
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const endOfWeek  = new Date(startOfDay.getTime() + 7 * 86400000);

  const events = await getEvents(startOfDay, endOfWeek, 30).catch(e => {
    console.error('[barbara/brief] Calendar error:', e.message);
    return [];
  });

  if (!events.length) return '_No events this week._';

  const today      = now.toISOString().slice(0, 10);
  const todayEv    = events.filter(e => (e.start.slice(0, 10) === today));
  const upcomingEv = events.filter(e => (e.start.slice(0, 10) > today));

  const lines: string[] = [];

  if (todayEv.length) {
    lines.push(`*Today's calendar:*`);
    for (const e of todayEv) {
      const time = e.isAllDay ? 'all day' : formatEventTime(e);
      lines.push(`• ${time} — ${e.summary}${e.location ? ` _(${e.location})_` : ''}`);
    }
  } else {
    lines.push('*Today:* No events scheduled.');
  }

  if (upcomingEv.length) {
    lines.push(`*This week:*`);
    const byDay: Record<string, typeof upcomingEv> = {};
    for (const e of upcomingEv) {
      const day = e.start.slice(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(e);
    }
    for (const [day, evs] of Object.entries(byDay).slice(0, 5)) {
      const label = dateLabel(day, now);
      for (const e of evs) {
        const time = e.isAllDay ? '' : ` ${formatEventTime(e)}`;
        lines.push(`• ${label}${time} — ${e.summary}`);
      }
    }
  }

  return lines.join('\n');
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  due: string;
  status: string;
  context: string;
}

async function getOpenTasks(today: Date): Promise<Task[]> {
  if (!BARBARA_TASKS_DB) return [];
  const pages = await notionQuery(BARBARA_TASKS_DB, {
    property: 'Status', select: { does_not_equal: 'Done' },
  }).catch(() => []);
  return pages.map((pg: any) => {
    const p = pg.properties;
    return {
      id:      pg.id,
      title:   getTitle(p, 'Task') || getTitle(p, 'Name') || '',
      due:     getDate(p, 'Due Date') || '',
      status:  getSelect(p, 'Status') || 'Open',
      context: getText(p, 'Context') || '',
    };
  }).filter((t: Task) => t.title);
}

function buildTaskSection(tasks: Task[], today: Date): string {
  if (!tasks.length) return '_No open tasks._';
  const overdue = tasks.filter(t => t.due && t.due < today.toISOString().slice(0, 10));
  const dueToday = tasks.filter(t => t.due === today.toISOString().slice(0, 10));
  const upcoming = tasks.filter(t => !t.due || t.due > today.toISOString().slice(0, 10));

  const lines: string[] = [];
  if (overdue.length) {
    lines.push(`🔴 *Overdue (${overdue.length}):*`);
    overdue.forEach(t => lines.push(`• ${t.title}${t.due ? ` _(was ${t.due})_` : ''}`));
  }
  if (dueToday.length) {
    lines.push(`🟡 *Due today:*`);
    dueToday.forEach(t => lines.push(`• ${t.title}`));
  }
  if (upcoming.length) {
    lines.push(`📋 *Open tasks (${upcoming.length}):*`);
    upcoming.slice(0, 5).forEach(t => lines.push(`• ${t.title}${t.due ? ` — due ${t.due}` : ''}`));
    if (upcoming.length > 5) lines.push(`_...and ${upcoming.length - 5} more_`);
  }
  return lines.join('\n');
}

// ── PVC Pulse ─────────────────────────────────────────────────────────────────

async function getPVCPulse(today: Date, origin: string): Promise<string> {
  try {
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 3);
    const pages  = await notionQuery(NOTION_CRM_DB, {
      property: 'Submission Date', date: { on_or_after: cutoff.toISOString().slice(0, 10) },
    }).catch(() => []);
    const count = pages.length;
    if (!count) return 'No new applications in the last 3 days.';
    const names = pages.slice(0, 3).map((pg: any) => getTitle(pg.properties, 'Name')).filter(Boolean);
    return `${count} new application${count > 1 ? 's' : ''} in the last 3 days${names.length ? `: ${names.join(', ')}${count > 3 ? '...' : ''}` : ''}.`;
  } catch { return 'Could not fetch PVC pulse.'; }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runBrief(origin: string): Promise<string> {
  const nowUTC = new Date();
  const nowSAST = toSAST(nowUTC);
  const today   = new Date(nowSAST.toISOString().slice(0, 10));

  const dayStr = nowSAST.toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Johannesburg',
  });

  const [calSection, tasks, pvcPulse] = await Promise.all([
    buildCalendarSection(nowSAST),
    getOpenTasks(today),
    getPVCPulse(today, origin),
  ]);

  const taskSection = buildTaskSection(tasks, today);

  const lines = [
    `☀️ *Good morning, Lliam — ${dayStr}*`,
    ``,
    `📅 *Calendar*`,
    calSection,
    ``,
    `✅ *Tasks*`,
    taskSection,
    ``,
    `⚡ *PVC Pulse*`,
    pvcPulse,
    ``,
    `_Reply to add a task, update me on something, or ask about your day. I'm here. — Barbara_`,
  ];

  return lines.join('\n');
}

export const POST: APIRoute = async ({ request }) => {
  const isCron  = request.headers.get('x-vercel-cron') === '1';
  const isAdmin = ADMIN_KEY && request.headers.get('x-admin-key') === ADMIN_KEY;
  if (!isCron && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const url     = new URL(request.url);
  const preview = url.searchParams.get('preview') === '1';

  try {
    const message = await runBrief(url.origin);

    if (preview) {
      return new Response(JSON.stringify({ ok: true, preview: message }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (!LLIAM_SLACK_ID) {
      console.warn('[barbara/brief] BARBARA_SLACK_USER_ID not set — cannot DM');
      return new Response(JSON.stringify({ ok: false, error: 'BARBARA_SLACK_USER_ID not set' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    await postMessage(LLIAM_SLACK_ID, message);
    console.log('[barbara/brief] Sent morning brief to Lliam');
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('[barbara/brief] Error:', e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const GET: APIRoute = async ({ request }) => POST({ request } as any);
