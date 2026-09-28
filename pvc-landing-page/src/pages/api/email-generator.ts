import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';

const ADMIN_KEY = import.meta.env.ADMIN_KEY;

export const POST: APIRoute = async ({ request }) => {
  if (!ADMIN_KEY || request.headers.get('x-admin-key') !== ADMIN_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
  waitUntil(handleRequest(request.clone()));
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

async function handleRequest(request: Request) {
  try {
    const body = await request.json();
    const fields: { label: string; value: any }[] = body.data?.fields ?? [];

    const get = (label: string) =>
      fields.find((f) => f.label.toLowerCase().includes(label.toLowerCase()))?.value ?? '';

    const brief = get('brief');
    const subjectIdea = get('subject');
    const pillar = get('pillar');

    if (!brief) return;

    // Generate email copy via Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': import.meta.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1800,
        messages: [
          {
            role: 'user',
            content: `You are writing an email for Lliam Humphrey's PVC (Private Victories Club) subscriber list.

BRIEF: ${brief}
PILLAR: ${pillar || 'not specified'}
SUBJECT IDEA: ${subjectIdea || 'generate one'}

VOICE RULES — non-negotiable:
- Story-first. Always open with a scene, moment, or situation. The insight or lesson comes out of the story naturally — never state it upfront.
- Short paragraphs. 1–3 sentences max. White space is good.
- Conversational. Write how Lliam talks, not how a marketer writes.
- No bullet points. No numbered lists. No "here are X things."
- No corporate sign-offs. Just "Lliam" at the end, nothing else.
- Honest and occasionally vulnerable. Lliam is 20, building Africa's first private members club for entrepreneurs. He's figuring this out in real time.
- Don't mention PVC in every email. Many emails are just genuine stories or insights that build trust over time.
- Keep it under 380 words.

CONTEXT ON PVC:
- Private members club for African entrepreneurs doing R10k+/month
- Running dinner events (The Grillhouse, 15 founders around one table)
- Members-only WhatsApp community, weekly accountability, board Q&As
- Lliam built this at 20. The story is real.

Respond ONLY with valid JSON in this exact format — no markdown, no explanation:
{
  "subject": "...",
  "previewText": "...",
  "htmlContent": "<p>Hey {{contact.FIRSTNAME}},</p><p>...</p><p>Lliam</p>"
}`,
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    const raw = claudeData.content?.[0]?.text ?? '';

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const email = JSON.parse(cleaned);

    // Create Brevo campaign draft
    const campaignName = `[Auto] ${email.subject} — ${new Date().toLocaleDateString('en-ZA')}`;

    await fetch('https://api.brevo.com/v3/emailCampaigns', {
      method: 'POST',
      headers: {
        'api-key': import.meta.env.BREVO_API_KEY ?? '',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: campaignName,
        subject: email.subject,
        previewText: email.previewText ?? '',
        sender: { name: 'Lliam', email: 'lliamhumphreywork@gmail.com' },
        htmlContent: email.htmlContent,
        recipients: { listIds: [2, 3, 6, 10] },
      }),
    });
  } catch (err) {
    console.error('[email-generator]', err);
  }
}
