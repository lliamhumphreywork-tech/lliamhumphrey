const rateMap = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;
const NOTES_LIST_ID = 21;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://lliamhumphrey.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const { email, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true }); // honeypot

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Configuration error.' });

  try {
    const r = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, listIds: [NOTES_LIST_ID], updateEnabled: true }),
    });
    const json = await r.json().catch(() => ({}));

    if (r.status === 201 || r.status === 204 || json.code === 'duplicate_parameter') {
      return res.status(200).json({ ok: true });
    }
    console.error('notes-subscribe: Brevo error', r.status, json);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  } catch (err) {
    console.error('notes-subscribe: fetch error', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
