export const prerender = false;
import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/members-auth';
import { getMemberByEmail, createMember, updateMember } from '../../../lib/members-notion';

export const POST: APIRoute = async ({ request }) => {
  const session = getSession(request.headers.get('cookie'));
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 }); }

  const { name, business, role, instagram, location } = body;
  if (!name?.trim()) return new Response(JSON.stringify({ error: 'Name is required' }), { status: 400 });

  const fields = {
    name: name.trim(),
    business: (business ?? '').trim(),
    role: (role ?? '').trim(),
    instagram: (instagram ?? '').trim().replace(/^@/, ''),
    location: (location ?? '').trim(),
  };

  const member = await getMemberByEmail(session.email);
  let ok: boolean;
  if (member) {
    ok = await updateMember(member.id, fields);
  } else {
    const newId = await createMember(session.email, fields);
    ok = !!newId;
  }

  if (!ok) return new Response(JSON.stringify({ error: 'Failed to save' }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
