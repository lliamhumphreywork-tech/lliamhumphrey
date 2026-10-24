export const prerender = false;
import type { APIRoute } from 'astro';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';

const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? process.env.ADMIN_KEY;
const FIREBASE_PROJECT_ID = 'pvc-workspace';
const ADMIN_EMAILS = ['lliam@privatevictoriesclub.com'];

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export const GET: APIRoute = async ({ request }) => {
  if (!ADMIN_KEY) {
    console.error('[admin/session] ADMIN_KEY not set');
    return new Response('Unauthorized', { status: 401 });
  }

  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    console.warn(`[admin/session] Rate limit hit for IP ${ip}`);
    return new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return new Response('Unauthorized', { status: 401 });

  let claims: any;
  try {
    const verifyPromise = jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('JWKS_TIMEOUT')), 10_000)
    );
    const { payload } = await Promise.race([verifyPromise, timeoutPromise]);
    claims = payload;
  } catch (err: any) {
    if (err?.message === 'JWKS_TIMEOUT') {
      console.error('[admin/session] JWKS fetch timed out');
      return new Response('Auth service timeout — please try again', { status: 503 });
    }
    console.error('[admin/session] JWT verification failed:', err);
    return new Response('Unauthorized', { status: 401 });
  }

  if (!ADMIN_EMAILS.includes(claims.email as string)) {
    console.error(`[admin/session] Not an admin email: ${claims.email}`);
    return new Response('Unauthorized', { status: 401 });
  }

  return new Response(JSON.stringify({ key: ADMIN_KEY }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
