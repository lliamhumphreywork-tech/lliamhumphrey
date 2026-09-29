export const prerender = false;
import type { APIRoute } from 'astro';

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const ADMIN_KEY = import.meta.env.ADMIN_KEY;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

export const PATCH: APIRoute = async ({ request }) => {
  if (!auth(request)) return new Response('Unauthorized', { status: 401 });

  const { pageId, props } = await request.json();
  const PAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{32}$/i;
  if (!pageId || !PAGE_ID_RE.test(pageId)) return new Response('Invalid pageId', { status: 400 });
  if (!props) return new Response('Missing props', { status: 400 });

  // Map frontend field names to Notion property updates
  const properties: any = {};

  if (props.invited    !== undefined) properties['Invited?']        = { checkbox: props.invited };
  if (props.confirmed  !== undefined) properties['Confirmed?']      = { checkbox: props.confirmed };
  if (props.paid       !== undefined) properties['Paid?']           = { checkbox: props.paid };
  if (props.ticketSent !== undefined) properties['Ticket Sent?']    = { checkbox: props.ticketSent };
  if (props.attended   !== undefined) properties['Attended?']       = { checkbox: props.attended };
  if (props.type       !== undefined) properties['Type']            = { multi_select: props.type.map((n: string) => ({ name: n })) };
  if (props.notes      !== undefined) properties['Notes']           = { rich_text: [{ text: { content: props.notes } }] };
  if (props.status     !== undefined) properties['Status']          = { select: { name: props.status } };
  if (props.tier       !== undefined) properties['Tier']            = { select: { name: props.tier } };
  if (props.revenue    !== undefined) properties['Revenue']         = { select: { name: props.revenue } };

  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ properties }),
  });

  const data = await res.json();
  if (!res.ok) return new Response(JSON.stringify(data), { status: res.status });
  return new Response('OK', { status: 200 });
};
