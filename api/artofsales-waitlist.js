// Art of Sales waitlist: adds the contact to Brevo list 23 with optional questionnaire answers. No welcome email yet.
const rateMap = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;

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

  const { email, name, website, goal, maxPrice, income } = req.body || {};

  // Honeypot
  if (website) return res.status(200).json({ ok: true });

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const cleanName = (name || '').trim().slice(0, 100);
  const apiKey = process.env.BREVO_API_KEY;
  const listId = 23; // Brevo: Art of Sales > Art of Sales - Waitlist

  if (!apiKey) {
    console.error('artofsales-waitlist: missing BREVO_API_KEY');
    return res.status(500).json({ error: 'Configuration error.' });
  }

  try {
    // Add contact to list
    const contactPayload = {
      email: cleanEmail,
      listIds: [listId],
      updateEnabled: true,
    };
    // Optional questionnaire answers: only the fixed options are stored.
    const pick = (v, ok) => (ok.includes(v) ? v : '');
    const attrs = {};
    if (cleanName) attrs.FIRSTNAME = cleanName;
    const why = pick(goal, ['More money each month', 'Work from anywhere', 'Leave my job', 'A skill I can grow with']);
    if (why) attrs.AOS_GOAL = why;
    const price = pick(maxPrice, ['Under R200', 'R200 to R500', 'R500 to R1,000', 'Over R1,000']);
    const inc = pick(income, ['Not working', 'Under R8K', 'R8K to R20K', 'Over R20K']);
    if (price) attrs.AOS_MAX_PRICE = price;
    if (inc) attrs.AOS_INCOME = inc;
    if (Object.keys(attrs).length) contactPayload.attributes = attrs;

    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(contactPayload),
    });

    const contactJson = await contactRes.json().catch(() => ({}));

    // 201 = created, 204 = updated, duplicate = fine
    if (
      contactRes.status === 201 ||
      contactRes.status === 204 ||
      contactJson.code === 'duplicate_parameter'
    ) {
      return res.status(200).json({ ok: true });
    }

    console.error('artofsales-waitlist: Brevo error', contactRes.status, contactJson);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });

  } catch (err) {
    console.error('artofsales-waitlist: fetch error', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
