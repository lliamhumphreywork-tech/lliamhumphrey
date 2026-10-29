/**
 * Omnipresence OS hosted dashboard API (single function, no dependencies).
 * Storage: Upstash Redis REST (added to the Vercel project). Nothing here posts anywhere.
 *
 * Env (Vercel): KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*),
 *               OS_PASSWORD (dashboard login), OS_SECRET (cookie signing), OS_INGEST_KEY (Mac -> hosted push/pull)
 *
 * GET  ?op=clients | weeks&client= | posts&client=&week=     (login cookie)
 * POST op=login {password} | save {client,week,n,text?,status?}   (login cookie + X-OS: 1)
 * POST op=submit {client?, content, sources[], figures[], scheduledAt?, note?, apiKey}   (Cowork engine, adds one draft)
 * POST op=delete {client,week,n} | clear {client,week}   (login cookie, or ingest key)
 * POST op=ingest {client,week,posts,force?}  | GET op=export&client=&week=   (x-ingest-key header)
 */
const crypto = require('crypto');
const STATUSES = ['draft', 'needs_ok', 'approved', 'scheduled', 'posted'];
const NAME = /^[A-Za-z0-9_-]{1,40}$/;
const RURL = process.env.CONTENT_STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = process.env.CONTENT_STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function dropEmptyClient(client) {
  if ((await redis(['SCARD', `osw:${client}`])) === 0) await redis(['SREM', 'osc:clients', client]);
}

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
const ingestOk = (req, body) => !!process.env.OS_INGEST_KEY && safeEq((req.headers['x-ingest-key'] || (body && body.apiKey) || ''), process.env.OS_INGEST_KEY);

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}
const isoDay = (d) => d.toISOString().slice(0, 10);

function warnings(p) {
  const w = [];
  const first = (p.text.split('\n')[0] || '');
  if (!/\d/.test(first)) w.push('opening line has no hard number');
  const figDigits = p.figures.map((f) => f.split('|')[0]).join(' ').replace(/[^\d.,]/g, ' ').replace(/,/g, '');
  for (const tok of p.text.match(/\d[\d,]*\.?\d*/g) || []) {
    const t = tok.replace(/[.,]+$/, '').replace(/,/g, '');
    if (!t || /^(19|20)\d\d$/.test(t) || (/^\d+$/.test(t) && Number(t) <= 12)) continue;
    if (!figDigits.includes(t)) w.push(`number ${tok} is not in the figures list`);
  }
  if (p.text.includes('\u2014')) w.push('contains an em dash');
  const n = p.text.split(/\s+/).filter(Boolean).length;
  if (n < 90 || n > 260) w.push(`${n} words (aim 120 to 220)`);
  return w;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => res.status(code).json(obj);
  try {
    const missing = [];
    if (!RURL) missing.push('KV_REST_API_URL');
    if (!RTOK) missing.push('KV_REST_API_TOKEN');
    for (const k of ['OS_PASSWORD', 'OS_SECRET', 'OS_INGEST_KEY']) if (!process.env[k]) missing.push(k);
    if (missing.length) return send(500, { error: 'server not configured, missing: ' + missing.join(', ') });
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

    if (op === 'logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', 'os_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
      return send(200, { ok: true });
    }

    // Cowork / Mac -> hosted: add one post (like VHP's /api/submit)
    if (op === 'submit' && req.method === 'POST') {
      if (!ingestOk(req, body)) return send(401, { error: 'unauthorized' });
      const cl = body.client || 'lliam';
      if (!NAME.test(cl)) return send(400, { error: 'bad client' });
      const text = String(body.content || '').trim().slice(0, 5000);
      const sources = (Array.isArray(body.sources) ? body.sources : []).map(String);
      const figures = (Array.isArray(body.figures) ? body.figures : []).map(String);
      if (!text) return send(400, { error: 'content required' });
      if (!sources.length || !sources.every((s) => /^https?:\/\//.test(s))) return send(400, { error: 'at least one http(s) source link required, no unsourced posts' });
      if (!figures.every((f) => /\|\s*https?:\/\//.test(f))) return send(400, { error: 'each figure needs a source: "489% | https://..."' });
      let date;
      if (body.scheduledAt && /^\d{4}-\d{2}-\d{2}/.test(body.scheduledAt)) date = new Date(body.scheduledAt.slice(0, 10) + 'T12:00:00Z');
      else {
        date = new Date(Date.now() + 864e5); date.setUTCHours(12, 0, 0, 0);
        const cache = {};
        for (let i = 0; i < 21; i++, date.setUTCDate(date.getUTCDate() + 1)) {
          if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
          const wk = isoWeek(date);
          cache[wk] = cache[wk] || JSON.parse((await redis(['GET', `osq:${cl}:${wk}`])) || '[]');
          if (!cache[wk].some((p) => p.day === isoDay(date))) break;
        }
      }
      if (isNaN(date)) return send(400, { error: 'bad scheduledAt' });
      const week = isoWeek(date), day = isoDay(date), key = `osq:${cl}:${week}`;
      const posts = JSON.parse((await redis(['GET', key])) || '[]');
      const post = { n: posts.reduce((m, p) => Math.max(m, p.n), 0) + 1, day, status: 'draft', note: String(body.note || '').slice(0, 500), sources, figures, text, source: body.source || 'api' };
      post.warnings = warnings(post);
      if (posts.some((p) => p.day === day)) post.warnings.push('another post is already on this day');
      posts.push(post);
      await redis(['SET', key, JSON.stringify(posts)]);
      await redis(['SADD', 'osc:clients', cl]);
      await redis(['SADD', `osw:${cl}`, week]);
      return send(200, { id: `${week}#${post.n}`, client: cl, week, n: post.n, day, status: 'draft', warnings: post.warnings });
    }

    // Mac -> hosted
    if (op === 'ingest' || op === 'export') {
      if (!ingestOk(req, body)) return send(401, { error: 'unauthorized' });
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
    const viaKey = ingestOk(req, body);
    if (!sessionOk(req) && !(viaKey && (op === 'delete' || op === 'clear'))) return send(401, { error: 'login required' });
    if (req.method === 'GET' && op === 'clients') return send(200, (await redis(['SMEMBERS', 'osc:clients'])).sort());
    if (!NAME.test(client || '')) return send(400, { error: 'bad client' });
    if (req.method === 'GET' && op === 'weeks') return send(200, (await redis(['SMEMBERS', `osw:${client}`])).sort().reverse());
    if (!/^\d{4}-W\d{2}$/.test(week || '')) return send(400, { error: 'bad week' });
    const key = `osq:${client}:${week}`;
    if (req.method === 'GET' && op === 'posts') {
      return send(200, { posts: JSON.parse((await redis(['GET', key])) || '[]'), job: '', problems: [] });
    }
    if (req.method === 'POST' && op === 'clear') {
      if (!viaKey && req.headers['x-os'] !== '1') return send(403, { error: 'forbidden' });
      await redis(['DEL', key]);
      await redis(['SREM', `osw:${client}`, week]);
      await dropEmptyClient(client);
      return send(200, { ok: true });
    }
    if (req.method === 'POST' && op === 'delete') {
      if (!viaKey && req.headers['x-os'] !== '1') return send(403, { error: 'forbidden' });
      const posts = JSON.parse((await redis(['GET', key])) || '[]').filter((x) => x.n !== body.n);
      if (posts.length) await redis(['SET', key, JSON.stringify(posts)]);
      else { await redis(['DEL', key]); await redis(['SREM', `osw:${client}`, week]); await dropEmptyClient(client); }
      return send(200, { ok: true });
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
      if (typeof body.day === 'string') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.day)) return send(400, { error: 'bad day' });
        p.day = body.day;
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
