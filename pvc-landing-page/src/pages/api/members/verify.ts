export const prerender = false;
import type { APIRoute } from 'astro';
import { verifyMagicToken, generateSessionCookie } from '../../../lib/members-auth';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const PORTAL_ACCESS_DB = import.meta.env.NOTION_PORTAL_ACCESS_DB_ID;

async function checkAccess(email: string): Promise<boolean> {
  if (!NOTION_TOKEN || !PORTAL_ACCESS_DB) return false;
  const res = await fetch(`https://api.notion.com/v1/databases/${PORTAL_ACCESS_DB}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: 'Email', title: { equals: email.toLowerCase() } },
          { property: 'Approved', checkbox: { equals: true } },
        ],
      },
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return (data.results?.length ?? 0) > 0;
}

async function logRequest(email: string): Promise<void> {
  if (!NOTION_TOKEN || !PORTAL_ACCESS_DB) return;
  // Check if already exists before adding
  const checkRes = await fetch(`https://api.notion.com/v1/databases/${PORTAL_ACCESS_DB}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: { property: 'Email', title: { equals: email.toLowerCase() } },
    }),
  });
  if (checkRes.ok) {
    const data = await checkRes.json();
    if ((data.results?.length ?? 0) > 0) return;
  }
  await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: PORTAL_ACCESS_DB },
      properties: {
        Email: { title: [{ text: { content: email.toLowerCase() } }] },
        Approved: { checkbox: false },
      },
    }),
  });
}

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';

  const verified = verifyMagicToken(token);
  if (!verified) return redirect('/members?error=invalid');

  const email = verified.email;

  // Log the access request in Notion (so you can approve)
  await logRequest(email);

  const approved = await checkAccess(email);
  if (!approved) return redirect('/members/pending');

  const cookie = generateSessionCookie(email, email);
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/members/dashboard',
      'Set-Cookie': cookie,
    },
  });
};
