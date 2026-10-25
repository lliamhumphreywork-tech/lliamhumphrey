export const prerender = false;
import type { APIRoute } from 'astro';
import { notionQuery, notionCreate, getTitle, getSelect, titleProp, selectProp } from '../../../lib/notion';
import { postMessage } from '../../../lib/slack-bot';

const SIGNING_SECRET     = import.meta.env.SLACK_SIGNING_SECRET ?? '';
const LLIAM_SLACK_ID     = import.meta.env.BARBARA_SLACK_USER_ID ?? 'U0BSGLB9T4H';
const ANTHROPIC_API_KEY  = import.meta.env.ANTHROPIC_API_KEY ?? '';
const BARBARA_HISTORY_DB = 'e10763e1ebb24fadb230c3664e5392c7';
const BARBARA_TASKS_DB   = import.meta.env.BARBARA_TASKS_DB_ID ?? '';
const NOTION_MI_DB       = 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';
const NOTION_CRM_DB      = '872bd20eee31468f91bed1cd472e157a';

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
        content: getTitle(pg.properties, 'Message'),
      }))
      .filter((m: ChatMessage) => m.content);
  } catch { return []; }
}

async function saveMessage(role: 'user' | 'assistant', content: string): Promise<void> {
  try {
    await notionCreate(BARBARA_HISTORY_DB, {
      'Message': titleProp(content.slice(0, 2000)),
      'Role':    selectProp(role),
    });
  } catch (e: any) {
    console.error('[barbara/slack] Failed to save message:', e.message);
  }
}

// ── Barbara's system prompt ───────────────────────────────────────────────────

function buildSystemPrompt(): string {
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
- Summarize what Susan is doing or flag anything Susan reported that needs attention
- Keep context from what Lliam tells you in this conversation

How you communicate:
- Short and punchy unless he asks for depth
- Never use em dashes (—)
- No bullet points unless it genuinely helps
- Write like a smart person who knows him well, not like an AI assistant
- When he tells you something new (about the setter company, a deal, a problem), acknowledge it and keep it in mind for this conversation

If he asks you to add a task: acknowledge it and let him know you've noted it (tasks are saved to his Barbara Tasks board in Notion).
If he asks what's on his calendar: let him know calendar isn't connected yet but you can work from what he tells you.
If he asks about Susan or PVC: you know the system — brief him accurately.`;
}

// ── Claude call ───────────────────────────────────────────────────────────────

async function askBarbara(history: ChatMessage[], userMessage: string): Promise<string> {
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
      max_tokens: 600,
      system:     buildSystemPrompt(),
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? '(no response)';
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

  // Respond async — Slack requires 200 within 3s
  // We fire-and-forget the actual processing
  (async () => {
    try {
      const [history] = await Promise.all([getHistory(12)]);
      const reply     = await askBarbara(history, userMessage);

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
  })();

  return new Response('OK', { status: 200 });
};

export const GET: APIRoute = async () => new Response('Barbara is listening.', { status: 200 });
