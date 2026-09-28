export const prerender = false;
import type { APIRoute } from 'astro';

const ADMIN_KEY = import.meta.env.ADMIN_KEY;
const FIREBASE_PROJECT_ID = 'pvc-workspace';

export const GET: APIRoute = async ({ request }) => {
  if (!ADMIN_KEY) return new Response('Unauthorized', { status: 401 });

  const authHeader = request.headers.get('Authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return new Response('Unauthorized', { status: 401 });

  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!res.ok) return new Response('Unauthorized', { status: 401 });
    const claims = await res.json();
    // Verify the token belongs to the right Firebase project
    if (claims.aud !== FIREBASE_PROJECT_ID) {
      return new Response('Unauthorized', { status: 401 });
    }
    return new Response(JSON.stringify({ key: ADMIN_KEY }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
};
