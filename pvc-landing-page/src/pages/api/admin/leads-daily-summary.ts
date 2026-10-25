export const prerender = false;
import type { APIRoute } from 'astro';
import { fetchLeads } from './leads-slack';

const ADMIN_KEY              = import.meta.env.ADMIN_KEY ?? '';
const SLACK_TOKEN            = import.meta.env.SLACK_BOT_TOKEN ?? '';
const SLACK_FOLLOWUP_CHANNEL = import.meta.env.SLACK_FOLLOWUP_CHANNEL
  || import.meta.env.SLACK_LEADS_CHANNEL
  || '';
const SLACK_LEADS_WEBHOOK    = import.meta.env.SLACK_LEADS_URL ?? '';
const NOTION_TOKEN           = import.meta.env.NOTION_TOKEN ?? '';
const NOTION_CRM_DB          = '872bd20eee31468f91bed1cd472e157a';

function formatSummary(leads: any[]): string {
  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
  const eventLeads = leads.filter(l => !l.isCommunityLead);

  const firstContact  = eventLeads.filter(l => l.action === 'contact');
  const followUp      = eventLeads.filter(l => l.action === 'follow_up');
  const switchChannel = eventLeads.filter(l => l.action === 'switch_channel');
  const done          = eventLeads.filter(l => ['Paid', 'Declined'].includes(l.status));
  const timingIssue   = eventLeads.filter(l => l.status === 'Timing Issue');
  const waiting       = eventLeads.filter(l => l.action === 'none' && !['Paid', 'Declined', 'Timing Issue'].includes(l.status));

  const dueCount = firstContact.length + followUp.length + switchChannel.length;

  const lines: string[] = [];
  lines.push(`*CT Leads: Follow-up Queue — ${today}*`);
  lines.push(dueCount > 0 ? `${dueCount} action${dueCount !== 1 ? 's' : ''} due today` : 'Nothing due today — clean slate.');
  lines.push('');

  if (firstContact.length) {
    lines.push('*FIRST CONTACT*');
    firstContact.forEach(l => {
      const days = l.daysSinceLead;
      const overdue = days > 1 ? ` *(${days}d — overdue)*` : '';
      lines.push(`• ${l.name} — ${l.business || l.ticket || 'no details'}${overdue}`);
    });
    lines.push('');
  }

  if (followUp.length) {
    lines.push('*FOLLOW UP*');
    followUp.forEach(l => {
      const tag = l.overdue ? ` *(overdue ${l.daysSinceChange}d)*` : ` (${l.daysSinceChange}d since contact)`;
      lines.push(`• ${l.name} — ${l.business || l.ticket || 'no details'}${tag}`);
    });
    lines.push('');
  }

  if (switchChannel.length) {
    lines.push('*SWITCH CHANNEL (no response 6+ days)*');
    switchChannel.forEach(l => {
      lines.push(`• ${l.name} — try WhatsApp or IG DM (${l.daysSinceChange}d)`);
    });
    lines.push('');
  }

  if (waiting.length) {
    lines.push(`_Waiting on response: ${waiting.map(l => l.name).join(', ')}_`);
    lines.push('');
  }

  if (done.length) {
    const paid     = done.filter(l => l.status === 'Paid').map(l => l.name);
    const declined = done.filter(l => l.status === 'Declined').map(l => l.name);
    if (paid.length)     lines.push(`_Paid: ${paid.join(', ')}_`);
    if (declined.length) lines.push(`_Declined: ${declined.join(', ')}_`);
    lines.push('');
  }

  if (timingIssue.length) {
    lines.push(`_Timing issue (hold): ${timingIssue.map(l => l.name).join(', ')}_`);
  }

  return lines.join('\n').trim();
}

async function writeToCRM(text: string, actionCount: number): Promise<void> {
  if (!NOTION_TOKEN) return;
  const today = new Date().toISOString().split('T')[0];
  await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_CRM_DB },
      properties: {
        Name:              { title: [{ text: { content: `Daily Briefing — ${today}` } }] },
        Type:              { multi_select: [{ name: 'Daily Briefing' }] },
        Status:            { select: { name: 'Daily Briefing' } },
        'Submission Date': { date: { start: today } },
        Notes:             { rich_text: [{ text: { content: text.slice(0, 2000) } }] },
      },
    }),
  });
}

async function postToSlack(text: string): Promise<{ ok: boolean; error?: string }> {
  // Prefer incoming webhook (no extra scopes needed)
  if (SLACK_LEADS_WEBHOOK) {
    const res = await fetch(SLACK_LEADS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `Webhook error: ${res.status}` };
  }
  // Fall back to chat.postMessage (requires chat:write scope)
  if (!SLACK_TOKEN || !SLACK_FOLLOWUP_CHANNEL) {
    return { ok: false, error: 'No Slack webhook or token configured' };
  }
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: SLACK_FOLLOWUP_CHANNEL, text, mrkdwn: true }),
  });
  const data = await res.json();
  return data.ok ? { ok: true } : { ok: false, error: data.error };
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const isCron = request.headers.get('x-vercel-cron') === '1';
  if (!isCron && (!ADMIN_KEY || request.headers.get('x-admin-key') !== ADMIN_KEY)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { configured, leads, error } = await fetchLeads();
  if (!configured) {
    return new Response(JSON.stringify({ ok: false, error: 'Slack not configured' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (error) {
    return new Response(JSON.stringify({ ok: false, error }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const text = formatSummary(leads);
  const result = await postToSlack(text);

  return new Response(JSON.stringify({ ...result, preview: text }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ request }) => {
  const isCron = request.headers.get('x-vercel-cron') === '1';
  const isAdmin = ADMIN_KEY && request.headers.get('x-admin-key') === ADMIN_KEY;
  if (!isCron && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { configured, leads, error } = await fetchLeads();
  if (!configured) {
    return new Response(JSON.stringify({ ok: false, error: 'Slack not configured' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (error) {
    return new Response(JSON.stringify({ ok: false, error }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const actionCount = leads.filter(l => !l.isCommunityLead && ['contact', 'follow_up', 'switch_channel'].includes(l.action)).length;
  const text = formatSummary(leads);

  // Cron: write briefing to Notion CRM. Admin preview: return text only.
  if (isCron) {
    try {
      await writeToCRM(text, actionCount);
      console.log(`[leads-daily-summary] CRM briefing written — ${actionCount} actions`);
      return new Response(JSON.stringify({ ok: true, actionCount, preview: text }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      console.error('[leads-daily-summary] CRM write failed:', e.message);
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ preview: text }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
