export const prerender = false;
import type { APIRoute } from 'astro';

const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? process.env.ADMIN_KEY;
const FIREBASE_PROJECT_ID = 'pvc-workspace';

export const GET: APIRoute = async ({ request }) => {
  if (!ADMIN_KEY) {
    console.error('[admin/session] ADMIN_KEY not set');
    return new Response('Unauthorized', { status: 401 });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return new Response('Unauthorized', { status: 401 });

  try {
    // Firebase ID tokens are verified against Firebase's public keys
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(import.meta.env.FIREBASE_WEB_API_KEY ?? process.env.FIREBASE_WEB_API_KEY ?? 'AIzaSyClcxxc3RVCM5giPNF0fPw5Sv6HNmbYhzQ')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) {
      console.error(`[admin/session] Firebase token verify failed: ${res.status}`);
      return new Response('Unauthorized', { status: 401 });
    }
    const data = await res.json();
    if (!data.users?.length) return new Response('Unauthorized', { status: 401 });
    return new Response(JSON.stringify({ key: ADMIN_KEY }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[admin/session] Error:', e.message);
    return new Response('Unauthorized', { status: 401 });
  }
};
