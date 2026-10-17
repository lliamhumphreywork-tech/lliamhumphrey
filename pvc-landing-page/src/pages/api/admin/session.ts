export const prerender = false;
import type { APIRoute } from 'astro';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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

  const authHeader = request.headers.get('Authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return new Response('Unauthorized', { status: 401 });

  let claims: any;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    claims = payload;
  } catch (err) {
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
