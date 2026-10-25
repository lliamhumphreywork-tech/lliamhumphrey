const BREVO_API_KEY = import.meta.env.BREVO_API_KEY ?? '';
const BREVO_BASE    = 'https://api.brevo.com/v3';

const headers = () => ({
  'api-key': BREVO_API_KEY,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
});

// Send a transactional template to one recipient
export async function sendTemplate(
  templateId: number,
  to: { email: string; name?: string },
  params?: Record<string, string>,
): Promise<void> {
  if (!BREVO_API_KEY || !to.email) return;
  const res = await fetch(`${BREVO_BASE}/smtp/email`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ templateId, to: [{ email: to.email, name: to.name ?? '' }], params }),
  });
  if (!res.ok) throw new Error(`Brevo template ${templateId} error ${res.status}: ${await res.text()}`);
}

// Create or update a contact and enrol in lists
export async function enrollContact(
  email: string,
  attributes: Record<string, any>,
  listIds: number[],
): Promise<void> {
  if (!BREVO_API_KEY || !email) return;
  const res = await fetch(`${BREVO_BASE}/contacts`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ email, attributes, listIds, updateEnabled: true }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Brevo enrol error ${res.status}: ${await res.text()}`);
  }
}
