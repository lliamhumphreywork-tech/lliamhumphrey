export const prerender = false;
import type { APIRoute } from 'astro';
import { fetchLeads } from './leads-slack';

const ADMIN_KEY              = import.meta.env.ADMIN_KEY ?? '';
const SLACK_TOKEN            = import.meta.env.SLACK_BOT_TOKEN ?? '';
const SLACK_FOLLOWUP_CHANNEL = import.meta.env.SLACK_FOLLOWUP_CHANNEL
  || import.meta.env.SLACK_LEADS_CHANNEL
  || '';
const SLACK_LEADS_WEBHOOK    = import.meta.env.SLACK_LEADS_URL ?? '';

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
  const url = new URL(request.url);
  if (!ADMIN_KEY || request.headers.get('x-admin-key') !== ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { configured, leads, error } = await fetchLeads();
  if (!configured || error) {
    return new Response(JSON.stringify({ ok: false, error: error || 'Not configured' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const text = formatSummary(leads);
  return new Response(JSON.stringify({ preview: text }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
