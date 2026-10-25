export const prerender = false;

const SLACK_BOT_TOKEN = import.meta.env.SLACK_BOT_TOKEN ?? '';

// Send a DM or channel message via Slack bot API
export async function postMessage(channel: string, text: string): Promise<void> {
  if (!SLACK_BOT_TOKEN || !channel) return;
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text, mrkdwn: true }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack postMessage error: ${data.error}`);
}
