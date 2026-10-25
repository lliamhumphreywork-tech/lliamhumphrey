// Post a plain-text message to any Slack incoming webhook URL.
// Silently no-ops when webhookUrl is empty — safe to call without checking.
export async function postWebhook(webhookUrl: string, text: string): Promise<void> {
  if (!webhookUrl) return;
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}
