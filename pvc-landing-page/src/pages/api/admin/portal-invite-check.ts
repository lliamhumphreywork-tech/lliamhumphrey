export const prerender = false;
import type { APIRoute } from 'astro';
import { notionQuery, notionPatch, checkProp, textProp } from '../../../lib/notion';
import { postWebhook } from '../../../lib/slack';

const NOTION_CRM_DB      = '872bd20eee31468f91bed1cd472e157a';
const MEMBERS_PORTAL_URL = 'https://members.privatevictoriesclub.com';
const MEMBERS_API_TOKEN  = import.meta.env.MEMBERS_API_TOKEN ?? '';
const SLACK_FINANCE_URL  = import.meta.env.SLACK_FINANCE_URL ?? '';
const ADMIN_KEY          = import.meta.env.ADMIN_KEY ?? '';

async function findUnprovisionedMembers(daysCutoff = 7): Promise<any[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysCutoff);

  const pages = await notionQuery(NOTION_CRM_DB, {
    and: [
      { property: 'Status',             select:   { equals:      'Member' } },
      { property: 'Portal Provisioned', checkbox: { equals:      false   } },
      { property: 'Submission Date',    date:     { on_or_after: cutoff.toISOString().split('T')[0] } },
    ],
  });

  return pages.map((page: any) => {
    const p = page.properties;
    return {
      pageId:    page.id,
      name:      (p['Name']?.title ?? []).map((t: any) => t.plain_text).join(''),
      email:     p['Email']?.email ?? '',
      submitted: p['Submission Date']?.date?.start ?? '',
    };
  }).filter((m: any) => m.email);
}

async function provisionPortalAccount(email: string, name: string): Promise<{ id: string; created: boolean } | null> {
  if (!MEMBERS_API_TOKEN) return null;
  const res = await fetch(`${MEMBERS_PORTAL_URL}/api/admin/invite`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MEMBERS_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) throw new Error(`Portal invite error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, created: data.created === true };
}

async function run() {
  const unprovisioned = await findUnprovisionedMembers(7);

  if (!unprovisioned.length) {
    console.log('[portal-invite-check] All recent members provisioned');
    return { checked: 0, fixed: 0, failed: 0, results: [] };
  }

  console.log(`[portal-invite-check] ${unprovisioned.length} unprovisioned member(s) found`);

  const results: { name: string; email: string; status: string }[] = [];

  for (const member of unprovisioned) {
    try {
      const result = await provisionPortalAccount(member.email, member.name);
      if (!result) {
        results.push({ name: member.name, email: member.email, status: 'skipped-no-token' });
        continue;
      }
      await notionPatch(member.pageId, {
        'Portal Provisioned': checkProp(true),
        'Portal User ID':     textProp(result.id),
      });
      results.push({ name: member.name, email: member.email, status: result.created ? 'provisioned' : 'already-existed' });
      console.log(`[portal-invite-check] Provisioned ${member.email} (created: ${result.created})`);
    } catch (e: any) {
      results.push({ name: member.name, email: member.email, status: `failed: ${e.message}` });
      console.error(`[portal-invite-check] Failed for ${member.email}:`, e.message);
      await postWebhook(
        SLACK_FINANCE_URL,
        `⚠️ *[PORTAL ACCESS — NEEDS MANUAL FIX]*\n*${member.name}* (${member.email}) paid for membership but portal access failed again.\nCreate their account manually: ${MEMBERS_PORTAL_URL}/admin\n*Member since:* ${member.submitted}`,
      ).catch(() => {});
    }
  }

  const fixed  = results.filter(r => r.status === 'provisioned').length;
  const failed = results.filter(r => r.status.startsWith('failed')).length;

  if (fixed > 0) {
    const names = results.filter(r => r.status === 'provisioned').map(r => r.name).join(', ');
    await postWebhook(SLACK_FINANCE_URL, `✅ *Portal invite check:* Fixed portal access for ${fixed} member${fixed !== 1 ? 's' : ''} — ${names}`).catch(() => {});
  }

  return { checked: unprovisioned.length, fixed, failed, results };
}

export const POST: APIRoute = async ({ request }) => {
  const isCron  = request.headers.get('x-vercel-cron') === '1';
  const isAdmin = ADMIN_KEY && request.headers.get('x-admin-key') === ADMIN_KEY;
  if (!isCron && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const result = await run();
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[portal-invite-check] Error:', e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const GET: APIRoute = async ({ request }) => {
  return POST({ request } as any);
};
