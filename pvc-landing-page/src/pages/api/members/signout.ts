export const prerender = false;
import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/members-auth';

export const POST: APIRoute = () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/members',
      'Set-Cookie': clearSessionCookie(),
    },
  });
};
