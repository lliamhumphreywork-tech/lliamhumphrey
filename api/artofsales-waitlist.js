// Art of Sales waitlist: creates or updates a MailerLite subscriber and adds them to the AoS Waitlist group.
// The MailerLite automation on that group sends the welcome email. The API key is read from the
// MAILERLITE_API_KEY environment variable and never leaves the server.
const { isIP } = require('net');

const ML_URL = 'https://connect.mailerlite.com/api/subscribers';
const GROUP_ID = '204422368730285945'; // AoS Waitlist. Keep as a string: it's too long for a JS number.

const WOULD_PAY = ['Under R300', 'R300 to R500', 'R500 to R800', 'Not sure yet'];
const SITUATION = ['Employed full-time', 'Employed part-time or freelancing', 'Studying', 'Between jobs'];

// Optional contact details. WhatsApp: spaces (and dashes/brackets) stripped, then 9 to 15 digits with an optional leading +.
// Instagram: leading @ removed, then Instagram's own rules (letters, digits, . and _, up to 30).
const WHATSAPP_RE = /^\+?\d{9,15}$/;
const IG_RE = /^[A-Za-z0-9._]{1,30}$/;
const cleanWhatsapp = (v) => v.replace(/[\s()-]/g, '');
const cleanInstagram = (v) => v.replace(/^@+/, '');

const MAX_NAME = 50;
const MAX_EMAIL = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Best-effort rate limit per IP. It lives in the function instance's memory, so it resets on cold starts.
const rateMap = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;
function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + RATE_WINDOW });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const fail = (res, status, error) => res.status(status).json({ ok: false, error });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://lliamhumphrey.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return fail(res, 429, 'Too many attempts. Try again in a minute.');

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return fail(res, 400, 'Invalid request.'); }
  }

  // Honeypot: bots fill the hidden field. Pretend it worked and do nothing.
  if (str(body.website)) return res.status(200).json({ ok: true });

  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const wouldPay = str(body.would_pay);
  const situation = str(body.current_situation);
  const whatsapp = cleanWhatsapp(str(body.whatsapp));
  const instagram = cleanInstagram(str(body.instagram));

  if (!name) return fail(res, 400, 'Add your first name.');
  if (name.length > MAX_NAME) return fail(res, 400, 'That name is too long.');
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return fail(res, 400, 'Enter a valid email address.');
  if (whatsapp && !WHATSAPP_RE.test(whatsapp)) return fail(res, 400, 'Check your WhatsApp number, e.g. +27 82 123 4567.');
  if (instagram && !IG_RE.test(instagram)) return fail(res, 400, 'Check your Instagram handle, e.g. @yourhandle.');
  if (!WOULD_PAY.includes(wouldPay)) return fail(res, 400, 'Pick a monthly price option.');
  if (!SITUATION.includes(situation)) return fail(res, 400, 'Pick what best describes you right now.');
  if (body.consent !== true) return fail(res, 400, 'Tick the box to agree to emails.');

  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.error('artofsales-waitlist: MAILERLITE_API_KEY is not set');
    return fail(res, 500, 'Something went wrong. Try again later.');
  }

  const fields = { name, would_pay: wouldPay, current_situation: situation };
  // Only send the optional ones when given, so a repeat signup without them doesn't wipe earlier values.
  if (whatsapp) fields.whatsapp = whatsapp;
  if (instagram) fields.instagram = instagram;

  // Opt-in record: when (UTC, "YYYY-MM-DD HH:MM:SS") and from which IP, only if it's a valid IPv4/IPv6. Never logged.
  const subscriber = { email, fields, groups: [GROUP_ID], opted_in_at: new Date().toISOString().slice(0, 19).replace('T', ' ') };
  if (isIP(ip)) subscriber.optin_ip = ip;

  try {
    const mlRes = await fetch(ML_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(subscriber),
    });
    // 201 = new subscriber, 200 = existing subscriber updated. Both are fine.
    if (mlRes.status === 200 || mlRes.status === 201) return res.status(200).json({ ok: true });

    // Log the status only: the response body can echo the subscriber's details.
    console.error('artofsales-waitlist: MailerLite returned', mlRes.status);
    return fail(res, 502, 'Something went wrong. Try again.');
  } catch (err) {
    console.error('artofsales-waitlist: request to MailerLite failed', err && err.name);
    return fail(res, 502, 'Something went wrong. Try again.');
  }
};
