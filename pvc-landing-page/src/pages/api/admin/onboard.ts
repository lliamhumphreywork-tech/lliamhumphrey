export const prerender = false;
import type { APIRoute } from 'astro';
import {
  notionQuery, notionPatch, notionCreate,
  getTitle, getText, getSelect, getEmail,
  titleProp, textProp, selectProp, checkProp,
} from '../../../lib/notion';
import { sendTemplate } from '../../../lib/brevo';
import { postWebhook } from '../../../lib/slack';

const ADMIN_KEY               = import.meta.env.ADMIN_KEY ?? '';
const NOTION_CRM_DB           = '872bd20eee31468f91bed1cd472e157a';
const NOTION_MI_DB            = 'd7f078c6-fd75-4feb-aba1-6d5d41d5c956';
const MEMBERS_PORTAL_URL      = 'https://members.privatevictoriesclub.com';
const MEMBERS_API_TOKEN       = import.meta.env.MEMBERS_API_TOKEN ?? '';
const SLACK_MEMBER_INTEL_URL  = import.meta.env.SLACK_MEMBER_INTEL_URL ?? '';
const BREVO_TEMPLATE_ONBOARD  = import.meta.env.BREVO_TEMPLATE_ONBOARDING
  ? parseInt(import.meta.env.BREVO_TEMPLATE_ONBOARDING, 10)
  : null;

function auth(req: Request) {
  return ADMIN_KEY !== '' && req.headers.get('x-admin-key') === ADMIN_KEY;
}

async function findCRMRecord(email?: string, name?: string) {
  if (email) {
    const r = await notionQuery(NOTION_CRM_DB, { property: 'Email', email: { equals: email.toLowerCase() } });
    if (r.length) return r[0];
  }
  if (name) {
    const r = await notionQuery(NOTION_CRM_DB, { property: 'Name', title: { contains: name } });
    if (r.length) return r[0];
  }
  return null;
}

async function findMIRecord(firstName: string) {
  const r = await notionQuery(NOTION_MI_DB, { property: 'Member', title: { contains: firstName } });
  return r.length ? r[0] : null;
}

async function createMIRecord(name: string, business: string, tier: string) {
  const today = new Date().toISOString().split('T')[0];
  return notionCreate(NOTION_MI_DB, {
    'Member':            titleProp(name),
    'Business':          textProp(business),
    'Tier':              tier ? selectProp(tier) : undefined,
    'Last Check-in':     { date: { start: today } },
    'Next Follow-up':    { date: { start: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] } },
  });
}

async function provisionPortal(email: string, name: string): Promise<{ id: string; created: boolean } | null> {
  if (!MEMBERS_API_TOKEN) return null;
  const res = await fetch(`${MEMBERS_PORTAL_URL}/api/admin/invite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MEMBERS_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) throw new Error(`Portal invite ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, created: data.created === true };
}

export const POST: APIRoute = async ({ request }) => {
  if (!auth(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { email, name, pageId: explicitPageId, tier: forceTier, notes } = body;
  if (!email && !name && !explicitPageId) {
    return new Response(JSON.stringify({ error: 'Provide email, name, or pageId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // 1. Look up CRM record
    const crmPage = explicitPageId
      ? (await notionQuery(NOTION_CRM_DB, undefined)).find((r: any) => r.id.replace(/-/g, '') === explicitPageId.replace(/-/g, ''))
        ?? null
      : await findCRMRecord(email, name);

    if (!crmPage) {
      return new Response(JSON.stringify({ error: 'No CRM record found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const p            = crmPage.properties;
    const memberName   = getTitle(p, 'Name');
    const memberEmail  = getEmail(p, 'Email');
    const memberBiz    = getText(p, 'Business');
    const currentStatus = getSelect(p, 'Status');
    const tier         = forceTier || getSelect(p, 'Tier') || '';
    const crmPageId    = crmPage.id;
    const firstName    = memberName.split(' ')[0];

    if (!['Accepted', 'Member'].includes(currentStatus)) {
      return new Response(JSON.stringify({ error: `Cannot onboard — CRM status is "${currentStatus}", expected "Accepted" or "Member"` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const steps: string[] = [];
    const warnings: string[] = [];

    // 2. Flip CRM status to Member
    if (currentStatus === 'Accepted') {
      await notionPatch(crmPageId, { Status: selectProp('Member') });
      steps.push('CRM status → Member');
    } else {
      steps.push('CRM status already Member');
    }

    // 3. Create MI record if missing
    const existingMI = await findMIRecord(firstName);
    let miPageId: string | null = existingMI?.id ?? null;
    if (!existingMI) {
      const mi = await createMIRecord(memberName, memberBiz, tier);
      miPageId  = mi.id;
      steps.push('Member Intelligence record created');
    } else {
      steps.push('Member Intelligence record already exists');
    }

    // 4. Provision portal
    let portalId: string | null = p['Portal User ID']?.rich_text?.[0]?.plain_text ?? null;
    if (!p['Portal Provisioned']?.checkbox) {
      try {
        const portal = await provisionPortal(memberEmail, memberName);
        if (portal) {
          portalId = portal.id;
          await notionPatch(crmPageId, {
            'Portal Provisioned': checkProp(true),
            'Portal User ID':     textProp(portal.id),
          });
          steps.push(portal.created ? 'Portal account created' : 'Portal account already existed — linked in CRM');
        } else {
          warnings.push('MEMBERS_API_TOKEN not set — portal step skipped');
        }
      } catch (e: any) {
        warnings.push(`Portal provision failed: ${e.message}`);
      }
    } else {
      steps.push('Portal already provisioned');
    }

    // 5. Send onboarding email
    if (BREVO_TEMPLATE_ONBOARD && memberEmail) {
      try {
        await sendTemplate(BREVO_TEMPLATE_ONBOARD, { email: memberEmail, name: firstName }, { FIRST_NAME: firstName });
        steps.push('Onboarding email sent');
      } catch (e: any) {
        warnings.push(`Onboarding email failed: ${e.message}`);
      }
    } else {
      warnings.push('No BREVO_TEMPLATE_ONBOARDING set — email skipped');
    }

    // 6. Post Slack checklist
    const slackLines = [
      `✅ *Onboarding complete: ${memberName}*`,
      `*Tier:* ${tier || 'not set'} · *Email:* ${memberEmail}`,
      notes ? `*Notes:* ${notes}` : '',
      '',
      '*Steps completed:*',
      ...steps.map(s => `• ✓ ${s}`),
      ...(warnings.length ? ['', '*Warnings:*', ...warnings.map(w => `• ⚠️ ${w}`)] : []),
      '',
      `Next: send them the member welcome WhatsApp message and introduce them in the PVC community.`,
    ].filter(l => l !== undefined);

    await postWebhook(SLACK_MEMBER_INTEL_URL, slackLines.join('\n')).catch(() => {});

    return new Response(JSON.stringify({
      ok: true,
      member: { name: memberName, email: memberEmail, tier },
      steps,
      warnings,
      miPageId,
      portalId,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('[onboard] Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
