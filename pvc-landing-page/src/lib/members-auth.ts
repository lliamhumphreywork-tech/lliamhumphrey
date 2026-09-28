import { createHmac } from 'crypto';

const SECRET = import.meta.env.MAGIC_LINK_SECRET;
if (!SECRET) throw new Error('MAGIC_LINK_SECRET env var must be set');
const LINK_TTL = 15 * 60 * 1000;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

export function generateMagicToken(email: string): string {
  const expiry = Date.now() + LINK_TTL;
  const payload = `${email}:${expiry}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

export function verifyMagicToken(token: string): { email: string } | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const payloadB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const payload = Buffer.from(payloadB64, 'base64url').toString();
    const colonIdx = payload.lastIndexOf(':');
    const email = payload.slice(0, colonIdx);
    const expiry = parseInt(payload.slice(colonIdx + 1));
    if (isNaN(expiry) || Date.now() > expiry) return null;
    const expectedSig = createHmac('sha256', SECRET).update(payload).digest('hex');
    if (sig !== expectedSig) return null;
    return { email };
  } catch {
    return null;
  }
}

export function generateSessionCookie(email: string, notionId: string): string {
  const expiry = Date.now() + SESSION_TTL;
  const payload = `${notionId}:${expiry}:${email}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  const value = `${Buffer.from(payload).toString('base64url')}.${sig}`;
  return `pvc_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}; Secure`;
}

export function clearSessionCookie(): string {
  return `pvc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getSession(cookieHeader: string | null): { email: string; notionId: string } | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/pvc_session=([^;]+)/);
  if (!match) return null;
  try {
    const raw = match[1];
    const dot = raw.lastIndexOf('.');
    if (dot === -1) return null;
    const payloadB64 = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const payload = Buffer.from(payloadB64, 'base64url').toString();
    const expectedSig = createHmac('sha256', SECRET).update(payload).digest('hex');
    if (sig !== expectedSig) return null;
    // payload: notionId:expiry:email
    const firstColon = payload.indexOf(':');
    const secondColon = payload.indexOf(':', firstColon + 1);
    const notionId = payload.slice(0, firstColon);
    const expiry = parseInt(payload.slice(firstColon + 1, secondColon));
    const email = payload.slice(secondColon + 1);
    if (isNaN(expiry) || Date.now() > expiry) return null;
    return { email, notionId };
  } catch {
    return null;
  }
}
