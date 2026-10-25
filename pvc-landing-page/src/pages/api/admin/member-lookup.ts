export const prerender = false;
import type { APIRoute } from 'astro';
import { notionQuery, getTitle, getText, getSelect, getNum, getDate, getEmail, getPhone } from '../../../lib/notion';

const ADMIN_KEY          = import.meta.env.ADMIN_KEY ?? '';
const NOTION_CRM_DB_ID   = '872bd20eee31468f91bed1cd472e157a';
const NOTION_MI_DB_ID    = 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';
const NOTION_FINANCE_DB_ID = import.meta.env.NOTION_FINANCE_DB_ID ?? '';

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function queryCRM(email: string) {
  const results = await notionQuery(NOTION_CRM_DB_ID, {
    filter: { property: 'Email', email: { equals: email.toLowerCase() } },
  });
  if (!results.length) return null;
  const p = results[0].properties;
  return {
    pageId:     results[0].id,
    name:       getTitle(p, 'Name'),
    email:      getEmail(p, 'Email'),
    phone:      getPhone(p, 'Phone'),
    instagram:  getText(p, 'IG'),
    business:   getText(p, 'Business'),
    revenue:    getSelect(p, 'Revenue'),
    status:     getSelect(p, 'Status'),
    type:       (p['Type']?.multi_select ?? []).map((t: any) => t.name) as string[],
    goals:      getText(p, 'Goals'),
    commitment: getSelect(p, 'Commitment'),
    notes:      getText(p, 'Notes'),
    score:      getNum(p, 'Application Score'),
    submittedAt: getDate(p, 'Submission Date'),
    portalProvisioned: p['Portal Provisioned']?.checkbox ?? false,
    portalUserId: getText(p, 'Portal User ID'),
  };
}

async function queryMemberIntelligence(name: string) {
  // Search by member name (title contains)
  const results = await notionQuery(NOTION_MI_DB_ID, {
    filter: { property: 'Member', title: { contains: name.split(' ')[0] } },
  });
  if (!results.length) return null;
  const p = results[0].properties;
  return {
    pageId:          results[0].id,
    business:        getText(p, 'Business'),
    goal:            getText(p, 'Goal (3 months)'),
    bottleneck:      getText(p, 'Current Bottleneck'),
    connections:     getText(p, 'Connection Made'),
    actionTaken:     getText(p, 'Action Taken'),
    result:          getText(p, 'Result'),
    revenueStage:    getSelect(p, 'Revenue Stage'),
    tier:            getSelect(p, 'Tier'),
    onboardingFormComplete: p['Onboarding Form Complete']?.checkbox ?? false,
    lastCheckIn:     getDate(p, 'Last Check-in'),
    nextFollowUp:    getDate(p, 'Next Follow-up'),
    crmPageId:       getText(p, 'CRM Page ID'),
  };
}

async function queryPayments(email: string) {
  if (!NOTION_FINANCE_DB_ID) return [];
  const results = await notionQuery(NOTION_FINANCE_DB_ID, {
    filter: { property: 'Email', email: { equals: email.toLowerCase() } },
  });
  return results.map(r => {
    const p = r.properties;
    return {
      pageId:      r.id,
      entryName:   getTitle(p, 'Entry Name'),
      amount:      getNum(p, 'Amount'),
      item:        getText(p, 'Item'),
      category:    getSelect(p, 'Category'),
      status:      getSelect(p, 'Status'),
      date:        getDate(p, 'Date'),
      paymentId:   getText(p, 'Payment ID'),
    };
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!auth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url   = new URL(request.url);
  const email = url.searchParams.get('email')?.trim().toLowerCase();
  const name  = url.searchParams.get('name')?.trim();

  if (!email && !name) {
    return new Response(JSON.stringify({ error: 'Provide email or name query param' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // If only name provided, search CRM by name instead
    let crm: Awaited<ReturnType<typeof queryCRM>> = null;
    if (email) {
      crm = await queryCRM(email);
    } else if (name) {
      const results = await notionQuery(NOTION_CRM_DB_ID, {
        filter: { property: 'Name', title: { contains: name } },
      });
      if (results.length) {
        const p = results[0].properties;
        crm = {
          pageId:     results[0].id,
          name:       getTitle(p, 'Name'),
          email:      getEmail(p, 'Email'),
          phone:      getPhone(p, 'Phone'),
          instagram:  getText(p, 'IG'),
          business:   getText(p, 'Business'),
          revenue:    getSelect(p, 'Revenue'),
          status:     getSelect(p, 'Status'),
          type:       (p['Type']?.multi_select ?? []).map((t: any) => t.name) as string[],
          goals:      getText(p, 'Goals'),
          commitment: getSelect(p, 'Commitment'),
          notes:      getText(p, 'Notes'),
          score:      getNum(p, 'Application Score'),
          submittedAt: getDate(p, 'Submission Date'),
          portalProvisioned: p['Portal Provisioned']?.checkbox ?? false,
          portalUserId: getText(p, 'Portal User ID'),
        };
      }
    }

    const lookupEmail = email ?? crm?.email ?? '';
    const lookupName  = crm?.name ?? name ?? '';

    const [mi, payments] = await Promise.all([
      lookupName ? queryMemberIntelligence(lookupName) : Promise.resolve(null),
      lookupEmail ? queryPayments(lookupEmail) : Promise.resolve([]),
    ]);

    if (!crm && !mi) {
      return new Response(JSON.stringify({ found: false }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      found: true,
      crm,
      memberIntelligence: mi,
      payments,
      summary: {
        name:        crm?.name ?? mi ? (lookupName) : '',
        email:       lookupEmail,
        status:      crm?.status ?? '',
        tier:        mi?.tier ?? '',
        revenueStage: mi?.revenueStage ?? crm?.revenue ?? '',
        lastCheckIn: mi?.lastCheckIn ?? '',
        nextFollowUp: mi?.nextFollowUp ?? '',
        totalPaid:   payments.reduce((sum, p) => sum + (p.amount ?? 0), 0),
        paymentCount: payments.length,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('[member-lookup] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
