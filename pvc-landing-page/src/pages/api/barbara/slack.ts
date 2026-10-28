export const prerender = false;
import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import { notionQuery, notionCreate, getTitle, getText, getSelect, getDate, titleProp, selectProp } from '../../../lib/notion';
import { postMessage } from '../../../lib/slack-bot';

const SIGNING_SECRET     = import.meta.env.SLACK_SIGNING_SECRET ?? '';
const LLIAM_SLACK_ID     = import.meta.env.BARBARA_SLACK_USER_ID ?? 'U0BSGLB9T4H';
const ANTHROPIC_API_KEY  = import.meta.env.ANTHROPIC_API_KEY ?? '';
const BARBARA_HISTORY_DB = 'e10763e1ebb24fadb230c3664e5392c7';
const BARBARA_TASKS_DB   = import.meta.env.BARBARA_TASKS_DB_ID ?? '';
const NOTION_MI_DB       = 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';
const NOTION_CRM_DB      = '872bd20eee31468f91bed1cd472e157a';
const ADMIN_KEY          = import.meta.env.ADMIN_KEY ?? '';
const SITE_URL           = import.meta.env.PUBLIC_SITE_URL ?? 'https://privatevictoriesclub.com';

// ── Slack signature verification ──────────────────────────────────────────────

async function verifySlackSignature(request: Request, rawBody: string): Promise<boolean> {
  if (!SIGNING_SECRET) return false;
  const ts  = request.headers.get('x-slack-request-timestamp') ?? '';
  const sig = request.headers.get('x-slack-signature') ?? '';
  // Replay attack guard: reject requests older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const base    = `v0:${ts}:${rawBody}`;
  const key     = await crypto.subtle.importKey('raw', new TextEncoder().encode(SIGNING_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  const sigHex  = 'v0=' + Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return sigHex === sig;
}

// ── Conversation history ──────────────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'assistant'; content: string }

async function getHistory(limit = 12): Promise<ChatMessage[]> {
  try {
    const pages = await notionQuery(BARBARA_HISTORY_DB, undefined, [
      { property: 'Created', direction: 'descending' },
    ]);
    return pages
      .slice(0, limit)
      .reverse()
      .map((pg: any) => ({
        role:    (getSelect(pg.properties, 'Role') || 'user') as 'user' | 'assistant',
        content: getText(pg.properties, 'Body') || getTitle(pg.properties, 'Message'),
      }))
      .filter((m: ChatMessage) => m.content);
  } catch { return []; }
}

async function saveMessage(role: 'user' | 'assistant', content: string): Promise<void> {
  try {
    await notionCreate(BARBARA_HISTORY_DB, {
      'Message': titleProp(content.slice(0, 2000)),
      'Body':    textProp(content),
      'Role':    selectProp(role),
    });
  } catch (e: any) {
    console.error('[barbara/slack] Failed to save message:', e.message);
  }
}

// ── Open tasks ────────────────────────────────────────────────────────────────

async function getOpenTasksSummary(): Promise<string> {
  if (!BARBARA_TASKS_DB) return '';
  try {
    const pages = await notionQuery(BARBARA_TASKS_DB, {
      property: 'Status', select: { does_not_equal: 'Done' },
    });
    if (!pages.length) return 'No open tasks.';
    return pages.map((pg: any) => {
      const p = pg.properties;
      const title  = getTitle(p, 'Task') || getTitle(p, 'Name') || '';
      const due    = getDate(p, 'Due Date') || '';
      const status = getSelect(p, 'Status') || 'Open';
      if (!title) return null;
      return `- ${title}${due ? ` (due ${due})` : ''}${status !== 'Open' ? ` [${status}]` : ''}`;
    }).filter(Boolean).join('\n');
  } catch { return ''; }
}

// ── Susan data fetch ──────────────────────────────────────────────────────────

interface SusanData { flagged: any[]; connections: string; memberCount: number }

async function fetchSusanLatest(): Promise<SusanData | null> {
  if (!ADMIN_KEY) return null;
  try {
    const res = await fetch(`${SITE_URL}/api/admin/member-intel-sweep?preview=1`, {
      method: 'GET',
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return {
      flagged:     data.flagged ?? [],
      connections: data.connections ?? '',
      memberCount: data.members?.length ?? 0,
    };
  } catch { return null; }
}

function formatSusanSummary(d: SusanData): string {
  const lines: string[] = [`Susan's latest intel (${d.memberCount} members scanned):`];
  if (!d.flagged.length && !d.connections) {
    lines.push('- All clear. No overdue follow-ups, no stale check-ins.');
  } else {
    for (const f of d.flagged) {
      const icon = f.flag === 'overdue' ? '🔴' : f.flag === 'due_soon' ? '🟡' : '🔵';
      lines.push(`${icon} ${f.name} (${f.tier}) — ${f.reason}`);
      if (f.draft) lines.push(`  Angle: "${f.draft}"`);
    }
    if (d.connections && d.connections !== 'NO_MATCHES') {
      lines.push('');
      lines.push('Connection opportunities:');
      lines.push(d.connections.slice(0, 600));
    }
  }
  return lines.join('\n');
}

function isSusanQuery(msg: string): boolean {
  const lower = msg.toLowerCase();
  return ['susan', 'member intel', 'intel sweep', 'check-in', 'follow-up', 'members today', 'who needs', 'at risk'].some(k => lower.includes(k));
}

// ── Barbara's system prompt ───────────────────────────────────────────────────

function buildSystemPrompt(openTasks?: string, susanData?: string): string {
  const today = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg',
  });
  return `You are Barbara — Lliam Humphrey's executive assistant AI. Today is ${today} (South Africa time).

Who you are:
- Warm, direct, and sharp. You don't pad responses with filler or corporate speak.
- You know Lliam's businesses: Private Victories Club (PVC) — a high-performance entrepreneur community in South Africa — and his setter management company (a sales team outsourcing business he's building).
- You're senior to Susan (the PVC ops agent). Susan handles member intelligence, onboarding, and daily PVC reporting. You oversee everything.
- You help Lliam stay on top of his life: tasks, priorities, decisions, planning, and keeping his head clear.

What you can do:
- Help him think through decisions, draft messages, plan his week
- Track tasks he mentions (remind him to save them formally if he wants them remembered)
- Summarize Susan's latest member intelligence data — you have it loaded when relevant
- Keep context from what Lliam tells you in this conversation

How you communicate:
- Short and punchy unless he asks for depth
- Never use em dashes (—)
- No bullet points unless it genuinely helps
- Write like a smart person who knows him well, not like an AI assistant
- When he tells you something new (about the setter company, a deal, a problem), acknowledge it and keep it in mind for this conversation

If he asks you to add a task: acknowledge it and let him know you've noted it (tasks are saved to his Barbara Tasks board in Notion).
If he asks what's on his calendar: let him know calendar isn't connected yet but you can work from what he tells you.${openTasks ? `\n\nHis current open tasks (from Notion):\n${openTasks}\n\nUse this to answer questions about his tasks, priorities, or what's on his plate this week.` : ''}${susanData ? `\n\n${susanData}\n\nUse this to answer questions about specific members, who needs attention, connection opportunities, or what Susan flagged.` : ''}`;
}

// ── Claude call ───────────────────────────────────────────────────────────────

async function askBarbara(history: ChatMessage[], userMessage: string, openTasks?: string, susanData?: string): Promise<string> {
  const messages: ChatMessage[] = [...history, { role: 'user', content: userMessage }];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-5-5',
      max_tokens: 2048,
      system:     buildSystemPrompt(openTasks, susanData),
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const text = data.content?.find((b: any) => b.type === 'text')?.text?.trim();
  if (!text) {
    console.error('[barbara/slack] Empty Claude response:', JSON.stringify(data).slice(0, 500));
  }
  return text || "I hit a snag on my end. Try again?";
}

// ── Task detection ────────────────────────────────────────────────────────────

async function maybeAddTask(userMessage: string, barbaraReply: string): Promise<void> {
  if (!BARBARA_TASKS_DB) return;
  // Simple heuristic: if message sounds like adding a task
  const taskPhrases = ['remind me', 'add a task', 'don\'t forget', 'make a note', 'remember to', 'i need to', 'task:'];
  const lower = userMessage.toLowerCase();
  if (!taskPhrases.some(p => lower.includes(p))) return;
  try {
    // Ask Claude Haiku to extract the task
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 80,
        messages: [{ role: 'user', content: `Extract the task from this message as a short action phrase (under 100 chars). Output ONLY the task, nothing else. Message: "${userMessage}"` }],
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const task = data.content?.[0]?.text?.trim();
    if (task) {
      const { titleProp, selectProp } = await import('../../../lib/notion');
      await notionCreate(BARBARA_TASKS_DB, {
        'Task':     titleProp(task),
        'Status':   selectProp('Open'),
        'Added By': selectProp('Lliam'),
      });
    }
  } catch { /* silent */ }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.text();

  // Verify Slack signature
  const valid = await verifySlackSignature(request, rawBody);
  if (!valid) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Slack URL verification challenge (first-time setup)
  if (payload.type === 'url_verification') {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only handle message events
  if (payload.type !== 'event_callback') {
    return new Response('OK', { status: 200 });
  }

  const event = payload.event;

  // Only respond to DMs from Lliam, ignore bot messages and edits
  if (
    event.type !== 'message' ||
    event.bot_id ||
    event.subtype ||
    event.user !== LLIAM_SLACK_ID
  ) {
    return new Response('OK', { status: 200 });
  }

  const userMessage = (event.text ?? '').trim();
  if (!userMessage) return new Response('OK', { status: 200 });

  // Return 200 immediately (Slack requires < 3s), keep function alive with waitUntil
  waitUntil((async () => {
    try {
      const fetchSusan = isSusanQuery(userMessage) ? fetchSusanLatest() : Promise.resolve(null);
      const [history, openTasks, susanRaw] = await Promise.all([getHistory(10), getOpenTasksSummary(), fetchSusan]);
      const susanData = susanRaw ? formatSusanSummary(susanRaw) : undefined;
      const reply   = await askBarbara(history, userMessage, openTasks, susanData);

      await Promise.all([
        postMessage(event.channel, reply),
        saveMessage('user', userMessage),
        saveMessage('assistant', reply),
        maybeAddTask(userMessage, reply),
      ]);
    } catch (e: any) {
      console.error('[barbara/slack] Processing error:', e.message);
      await postMessage(event.channel, `Something went wrong on my end. Try again in a moment.`).catch(() => {});
    }
  })());

  return new Response('OK', { status: 200 });
};

export const GET: APIRoute = async () => new Response('Barbara is listening.', { status: 200 });
