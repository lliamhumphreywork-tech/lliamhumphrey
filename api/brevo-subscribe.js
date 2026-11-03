// Rate limiter: best-effort in-memory (resets per cold start — blunts bots)
const rateMap = new Map();
const RATE_LIMIT = 5;        // requests
const RATE_WINDOW = 60_000;  // ms

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, reset: now + RATE_WINDOW };
  if (now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  rateMap.set(ip, { count: entry.count + 1, reset: entry.reset });
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://lliamhumphrey.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const { email, name, website } = req.body || {};

  // Honeypot — silently succeed so bots think they worked
  if (website) return res.status(200).json({ ok: true });

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const cleanName = (name || '').trim().slice(0, 100);

  const apiKey    = process.env.BREVO_API_KEY;
  const listId    = Number(process.env.BREVO_LIST_ID);
  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID);

  if (!apiKey || !listId || !templateId) {
    console.error('brevo-subscribe: missing env vars');
    return res.status(500).json({ error: 'Configuration error.' });
  }

  const payload = {
    email: cleanEmail,
    includeListIds: [listId],
    templateId,
    redirectionUrl: 'https://lliamhumphrey.com/notes?confirmed=1',
  };
  if (cleanName) payload.attributes = { FIRSTNAME: cleanName };

  try {
    const r = await fetch('https://api.brevo.com/v3/contacts/doubleOptIn', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 201 = new contact + DOI email sent
    // 204 = already exists + DOI email sent
    if (r.status === 201 || r.status === 204) {
      return res.status(200).json({ ok: true });
    }

    const json = await r.json().catch(() => ({}));

    // Gracefully handle duplicate contacts — don't leak whether email is subscribed
    if (json.code === 'contact_already_exist') {
      return res.status(200).json({ ok: true });
    }

    console.error('brevo-subscribe: Brevo error', r.status, json);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });

  } catch (err) {
    console.error('brevo-subscribe: fetch error', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
