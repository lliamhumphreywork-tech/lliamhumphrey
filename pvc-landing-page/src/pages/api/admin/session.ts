export const prerender = false;
import type { APIRoute } from 'astro';

const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? process.env.ADMIN_KEY;
const FIREBASE_PROJECT_ID = 'pvc-workspace';
const ADMIN_EMAILS = ['lliam@privatevictoriesclub.com'];

function decodeJwt(token: string): any {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ request }) => {
  if (!ADMIN_KEY) {
    console.error('[admin/session] ADMIN_KEY not set');
    return new Response('Unauthorized', { status: 401 });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return new Response('Unauthorized', { status: 401 });

  const claims = decodeJwt(idToken);
  if (!claims) return new Response('Unauthorized', { status: 401 });

  const now = Math.floor(Date.now() / 1000);
  const validIss = claims.iss === `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
  const validAud = claims.aud === FIREBASE_PROJECT_ID;
  const notExpired = claims.exp > now;
  const isAdmin = ADMIN_EMAILS.includes(claims.email);

  if (!validIss || !validAud || !notExpired || !isAdmin) {
    console.error(`[admin/session] Token check failed: iss=${validIss} aud=${validAud} exp=${notExpired} admin=${isAdmin}`);
    return new Response('Unauthorized', { status: 401 });
  }

  return new Response(JSON.stringify({ key: ADMIN_KEY }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
