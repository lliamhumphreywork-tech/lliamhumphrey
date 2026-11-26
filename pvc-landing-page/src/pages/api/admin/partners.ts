export const prerender = false;
import type { APIRoute } from 'astro';
import { notionQuery, notionCreate, notionPatch, titleProp, textProp, selectProp, dateProp, checkProp } from '../../../lib/notion';

const DB_ID    = import.meta.env.NOTION_PARTNERS_DB_ID ?? '';
const ADMIN_KEY = import.meta.env.ADMIN_KEY ?? '';

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

function parsePartner(page: any) {
  const p = page.properties;
  return {
    id:              page.id,
    name:            (p['Name']?.title      ?? []).map((t: any) => t.plain_text).join(''),
    category:        p['Category']?.select?.name   ?? '',
    type:            p['Type']?.select?.name        ?? '',
    status:          p['Status']?.select?.name      ?? '',
    priority:        p['Priority']?.select?.name    ?? '',
    contactName:     (p['Contact Name']?.rich_text  ?? []).map((t: any) => t.plain_text).join(''),
    contactRoute:    (p['Contact Route']?.rich_text ?? []).map((t: any) => t.plain_text).join(''),
    routeVerified:   p['Route Verified']?.checkbox  ?? false,
    sourceUrl:       p['Source URL']?.url            ?? '',
    theAsk:          (p['The Ask']?.rich_text        ?? []).map((t: any) => t.plain_text).join(''),
    memberOffer:     (p['Member Offer']?.rich_text   ?? []).map((t: any) => t.plain_text).join(''),
    lastContactDate: p['Last Contact Date']?.date?.start ?? '',
    nextAction:      (p['Next Action']?.rich_text    ?? []).map((t: any) => t.plain_text).join(''),
    nextActionDate:  p['Next Action Date']?.date?.start  ?? '',
    notes:           (p['Notes']?.rich_text          ?? []).map((t: any) => t.plain_text).join(''),
  };
}

function buildProps(body: any) {
  const props: Record<string, any> = {};
  if (body.name            != null) props['Name']             = titleProp(body.name);
  if (body.category        != null) props['Category']         = selectProp(body.category);
  if (body.type            != null) props['Type']             = selectProp(body.type);
  if (body.status          != null) props['Status']           = selectProp(body.status);
  if (body.priority        != null) props['Priority']         = selectProp(body.priority);
  if (body.contactName     != null) props['Contact Name']     = textProp(body.contactName);
  if (body.contactRoute    != null) props['Contact Route']    = textProp(body.contactRoute);
  if (body.routeVerified   != null) props['Route Verified']   = checkProp(!!body.routeVerified);
  if (body.sourceUrl       != null) props['Source URL']       = { url: body.sourceUrl || null };
  if (body.theAsk          != null) props['The Ask']          = textProp(body.theAsk);
  if (body.memberOffer     != null) props['Member Offer']     = textProp(body.memberOffer);
  if (body.lastContactDate != null) props['Last Contact Date'] = body.lastContactDate ? dateProp(body.lastContactDate) : { date: null };
  if (body.nextAction      != null) props['Next Action']      = textProp(body.nextAction);
  if (body.nextActionDate  != null) props['Next Action Date'] = body.nextActionDate  ? dateProp(body.nextActionDate)  : { date: null };
  if (body.notes           != null) props['Notes']            = textProp(body.notes);
  return props;
}

function err(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}
function ok(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) return err(401, 'Unauthorized');
  if (!DB_ID) return err(503, 'NOTION_PARTNERS_DB_ID not set');
  let rows: any[];
  try { rows = await notionQuery(DB_ID); }
  catch (e: any) { return err(502, e.message); }
  return ok({ partners: rows.map(parsePartner) });
};

export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) return err(401, 'Unauthorized');
  if (!DB_ID) return err(503, 'NOTION_PARTNERS_DB_ID not set');
  let body: any;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }
  if (!body.name?.trim()) return err(400, 'Name is required');
  const props = buildProps(body);
  try {
    const page = await notionCreate(DB_ID, props);
    return ok({ partner: parsePartner(page) });
  } catch (e: any) { return err(502, e.message); }
};

export const PATCH: APIRoute = async ({ request }) => {
  if (!auth(request)) return err(401, 'Unauthorized');
  let body: any;
  try { body = await request.json(); } catch { return err(400, 'Invalid JSON'); }
  const { pageId, ...fields } = body;
  if (!pageId) return err(400, 'pageId is required');
  const props = buildProps(fields);
  if (!Object.keys(props).length) return err(400, 'No fields to update');
  try {
    await notionPatch(pageId, props);
    return ok({ ok: true });
  } catch (e: any) { return err(502, e.message); }
};
