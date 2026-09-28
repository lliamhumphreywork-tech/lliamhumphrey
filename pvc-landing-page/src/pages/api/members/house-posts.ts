export const prerender = false;
import type { APIRoute } from 'astro';
import { put, list, del } from '@vercel/blob';
import { getSession } from '../../../lib/members-auth';
import { getMemberByEmail } from '../../../lib/members-notion';

export const GET: APIRoute = async ({ request }) => {
  const session = getSession(request.headers.get('cookie'));
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const { blobs } = await list({ prefix: 'house/posts/' });
  if (blobs.length === 0) return new Response(JSON.stringify({ ok: true, posts: [] }), { headers: { 'Content-Type': 'application/json' } });
  const fetches = blobs.map(b => fetch(b.url).then(r => r.json()).catch(() => null));
  const posts = (await Promise.all(fetches))
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return new Response(JSON.stringify({ ok: true, posts }), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const session = getSession(request.headers.get('cookie'));
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const formData = await request.formData();
  const text = (formData.get('text') as string)?.trim();
  if (!text) return new Response(JSON.stringify({ error: 'Text required' }), { status: 400 });

  const member = await getMemberByEmail(session.email).catch(() => null);
  const name = member?.name || session.email.split('@')[0];
  const initial = name.charAt(0).toUpperCase();

  const id = `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  let photoUrl = '';
  const photo = formData.get('photo') as File | null;
  if (photo && photo.size > 0) {
    const ext = photo.name.split('.').pop() ?? 'jpg';
    const blob = await put(`house/photos/${id}.${ext}`, photo, { access: 'public', addRandomSuffix: false });
    photoUrl = blob.url;
  }

  const post = {
    id,
    text,
    photoUrl,
    authorName: name,
    authorEmail: session.email,
    authorInitial: initial,
    createdAt: new Date().toISOString(),
  };

  await put(`house/posts/${id}.json`, JSON.stringify(post), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });

  return new Response(JSON.stringify({ ok: true, post }), { headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: APIRoute = async ({ request }) => {
  const session = getSession(request.headers.get('cookie'));
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { id } = await request.json();
  const { blobs } = await list({ prefix: `house/posts/${id}` });
  const metaBlob = blobs[0];
  if (!metaBlob) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

  const post = await fetch(metaBlob.url).then(r => r.json());
  if (post.authorEmail !== session.email) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const toDelete = [metaBlob.url];
  if (post.photoUrl) toDelete.push(post.photoUrl);
  await del(toDelete);

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
