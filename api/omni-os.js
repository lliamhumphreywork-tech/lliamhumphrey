/**
 * Omnipresence OS hosted dashboard API (single function, no dependencies).
 * Storage: Upstash Redis REST (added to the Vercel project). Nothing here posts anywhere.
 *
 * Env (Vercel): KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*),
 *               OS_PASSWORD (dashboard login), OS_SECRET (cookie signing), OS_INGEST_KEY (Mac -> hosted push/pull)
 *
 * GET  ?op=clients | weeks&client= | posts&client=&week=     (login cookie)
 * POST op=login {password} | save {client,week,n,text?,status?}   (login cookie + X-OS: 1)
 * POST op=ingest {client,week,posts,force?}  | GET op=export&client=&week=   (x-ingest-key header)
 */
const crypto = require('crypto');
const STATUSES = ['draft', 'needs_ok', 'approved', 'scheduled', 'posted'];
const NAME = /^[A-Za-z0-9_-]{1,40}$/;
const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(RURL, { method: 'POST', headers: { Authorization: 'Bearer ' + RTOK }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const hmac = (s) => crypto.createHmac('sha256', process.env.OS_SECRET).update(s).digest('hex');
const safeEq = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
function sessionOk(req) {
  const m = /(?:^|;\s*)os_session=(\d+)\.([a-f0-9]+)/.exec(req.headers.cookie || '');
  return !!m && Number(m[1]) > Date.now() && safeEq(m[2], hmac('s' + m[1]));
}
const ingestOk = (req) => !!process.env.OS_INGEST_KEY && safeEq(req.headers['x-ingest-key'] || '', process.env.OS_INGEST_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => res.status(code).json(obj);
  try {
    if (!RURL || !RTOK || !process.env.OS_PASSWORD || !process.env.OS_SECRET) return send(500, { error: 'server not configured' });
    const q = req.query || {};
    const body = req.method === 'POST' ? req.body || {} : {};
    const op = q.op || body.op;
    const client = q.client || body.client, week = q.week || body.week;

    if (op === 'login' && req.method === 'POST') {
      if (!safeEq(body.password || '', process.env.OS_PASSWORD)) return send(401, { error: 'wrong password' });
      const exp = Date.now() + 30 * 864e5;
      res.setHeader('Set-Cookie', `os_session=${exp}.${hmac('s' + exp)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 86400}`);
      return send(200, { ok: true });
    }

    // Mac -> hosted
    if (op === 'ingest' || op === 'export') {
      if (!ingestOk(req)) return send(401, { error: 'unauthorized' });
      if (!NAME.test(client || '') || !/^\d{4}-W\d{2}$/.test(week || '')) return send(400, { error: 'bad client or week' });
      const key = `osq:${client}:${week}`;
      if (op === 'export') return send(200, { posts: JSON.parse((await redis(['GET', key])) || '[]') });
      const posts = body.posts;
      if (!Array.isArray(posts) || posts.length > 14) return send(400, { error: 'bad posts' });
      const old = JSON.parse((await redis(['GET', key])) || '[]');
      if (old.some((p) => p.status !== 'draft') && !body.force) return send(409, { error: 'week already has approved or later posts; use force' });
      await redis(['SET', key, JSON.stringify(posts)]);
      await redis(['SADD', 'osc:clients', client]);
      await redis(['SADD', `osw:${client}`, week]);
      return send(200, { ok: true, count: posts.length });
    }

    // dashboard
    if (!sessionOk(req)) return send(401, { error: 'login required' });
    if (req.method === 'GET' && op === 'clients') return send(200, (await redis(['SMEMBERS', 'osc:clients'])).sort());
    if (!NAME.test(client || '')) return send(400, { error: 'bad client' });
    if (req.method === 'GET' && op === 'weeks') return send(200, (await redis(['SMEMBERS', `osw:${client}`])).sort().reverse());
    if (!/^\d{4}-W\d{2}$/.test(week || '')) return send(400, { error: 'bad week' });
    const key = `osq:${client}:${week}`;
    if (req.method === 'GET' && op === 'posts') {
      return send(200, { posts: JSON.parse((await redis(['GET', key])) || '[]'), job: '', problems: [] });
    }
    if (req.method === 'POST' && op === 'save') {
      if (req.headers['x-os'] !== '1') return send(403, { error: 'forbidden' });
      const posts = JSON.parse((await redis(['GET', key])) || '[]');
      const p = posts.find((x) => x.n === body.n);
      if (!p) return send(400, { error: 'no such post' });
      if (body.status !== undefined) {
        if (!STATUSES.includes(body.status)) return send(400, { error: 'bad status' });
        p.status = body.status;
      }
      if (typeof body.text === 'string') p.text = body.text.slice(0, 5000).trim();
      await redis(['SET', key, JSON.stringify(posts)]);
      return send(200, { ok: true });
    }
    return send(404, { error: 'not found' });
  } catch (e) {
    return send(500, { error: 'server error' });
  }
};
