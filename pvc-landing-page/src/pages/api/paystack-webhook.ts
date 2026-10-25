export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import crypto from 'crypto';
import { notionQuery, notionPatch, notionCreate, titleProp, textProp, emailProp, numProp, selectProp, dateProp, checkProp } from '../../lib/notion';
import { sendTemplate, enrollContact } from '../../lib/brevo';
import { postWebhook } from '../../lib/slack';

const NOTION_FINANCE_DB_ID = import.meta.env.NOTION_FINANCE_DB_ID;
const NOTION_CRM_DB_ID     = '872bd20eee31468f91bed1cd472e157a';
const SLACK_FINANCE_URL    = import.meta.env.SLACK_FINANCE_URL ?? '';
const PAYSTACK_SECRET      = import.meta.env.PAYSTACK_SECRET_KEY;
const MEMBERS_PORTAL_URL   = 'https://members.privatevictoriesclub.com';
const MEMBERS_API_TOKEN    = import.meta.env.MEMBERS_API_TOKEN;

const TEMPLATE_MEMBERSHIP_ONBOARDING = 28;
const TEMPLATE_EVENT_CONFIRMATION    = 29;
const BREVO_LIST_4MONTH              = 14;

function verifyPaystackSignature(body: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
  return hash === signature;
}

async function isAlreadyProcessed(paymentId: string): Promise<boolean> {
  if (!NOTION_FINANCE_DB_ID || !paymentId) return false;
  try {
    const results = await notionQuery(NOTION_FINANCE_DB_ID, {
      property: 'Payment ID', rich_text: { equals: paymentId },
    });
    return results.length > 0;
  } catch {
    return false;
  }
}

async function createFinanceEntry(data: {
  name: string; email: string; amount: string;
  paymentId: string; itemName: string; paymentType: 'Membership' | 'Event' | 'Other';
}) {
  if (!NOTION_FINANCE_DB_ID) return;
  await notionCreate(NOTION_FINANCE_DB_ID, {
    'Entry Name': titleProp(data.name || 'Paystack Payment'),
    Email:        emailProp(data.email || ''),
    Amount:       numProp(parseFloat(data.amount)),
    'Payment ID': textProp(data.paymentId),
    Item:         textProp(data.itemName),
    Category:     selectProp(data.paymentType),
    Status:       selectProp('Complete'),
    Date:         dateProp(new Date().toISOString().split('T')[0]),
  });
}

// Returns the CRM page ID if a matching record was found and updated, null otherwise
async function updateCRMPaymentStatus(email: string, paymentType: 'Membership' | 'Event' | 'Other'): Promise<string | null> {
  if (paymentType === 'Other' || !email) return null;
  const results = await notionQuery(NOTION_CRM_DB_ID, { property: 'Email', email: { equals: email } });
  if (!results.length) return null;
  const pageId    = results[0].id;
  const newStatus = paymentType === 'Membership' ? 'Member' : 'Event Attendee';
  await notionPatch(pageId, { Status: selectProp(newStatus) });
  return pageId;
}

// Writes portal provision result back to CRM so we have a record
async function patchPortalProvisioned(crmPageId: string, portalUserId: string): Promise<void> {
  await notionPatch(crmPageId, {
    'Portal Provisioned': checkProp(true),
    'Portal User ID':     textProp(portalUserId),
  });
}

// Returns { id, created } or null when config is missing
async function provisionPortalAccount(email: string, name: string): Promise<{ id: string; created: boolean } | null> {
  if (!MEMBERS_API_TOKEN || !email) return null;
  const res = await fetch(`${MEMBERS_PORTAL_URL}/api/admin/invite`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${MEMBERS_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name }),
  });
  if (!res.ok) throw new Error(`Portal invite error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, created: data.created === true };
}

async function sendPaymentConfirmation(email: string, firstName: string, paymentType: 'Membership' | 'Event' | 'Other', itemName: string) {
  if (paymentType === 'Other') return;
  const templateId = paymentType === 'Event' ? TEMPLATE_EVENT_CONFIRMATION : TEMPLATE_MEMBERSHIP_ONBOARDING;
  await sendTemplate(templateId, { email, name: firstName }, { firstName, itemName });
}

async function tag4MonthRenewal(email: string, name: string) {
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + 105);
  const renewalStr = renewalDate.toISOString().split('T')[0];
  await enrollContact(email, {
    FIRSTNAME: name.split(' ')[0],
    RENEWAL_DUE: renewalStr,
    MEMBER_SINCE: new Date().toISOString().split('T')[0],
  }, [BREVO_LIST_4MONTH]);
}

export const POST: APIRoute = async ({ request }) => {
  const body      = await request.text();
  const signature = request.headers.get('x-paystack-signature');

  if (!verifyPaystackSignature(body, signature, PAYSTACK_SECRET)) {
    console.warn('[paystack-webhook] Signature verification failed');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }

  if (payload.event !== 'charge.success') {
    console.log(`[paystack-webhook] Event ${payload.event} - no action`);
    return new Response('OK', { status: 200 });
  }

  const data        = payload.data ?? {};
  const amountRands = (data.amount / 100).toFixed(2);
  const paymentId   = data.reference ?? '';
  const email       = data.customer?.email ?? data.metadata?.email ?? '';
  const name        = data.metadata?.name ?? data.metadata?.custom_fields?.find((f: any) => f.variable_name === 'name')?.value ?? `${data.customer?.first_name ?? ''} ${data.customer?.last_name ?? ''}`.trim();
  const firstName   = name.split(' ')[0] ?? '';
  const itemName    = data.metadata?.item_name ?? data.metadata?.custom_fields?.find((f: any) => f.variable_name === 'item_name')?.value ?? data.plan?.name ?? 'PVC Payment';

  const lower = itemName.toLowerCase();
  const paymentType: 'Membership' | 'Event' | 'Other' =
    lower.includes('membership') ? 'Membership' :
    lower.includes('event') || lower.includes('dinner') || lower.includes('ticket') || lower.includes('admission') ||
    lower.includes('mastermind') || lower.includes('cape town') || lower.includes('summit') || lower.includes('workshop') ? 'Event' :
    'Other';

  console.log(`[paystack-webhook] charge.success - ${name} R${amountRands} | ${paymentType}`);

  if (await isAlreadyProcessed(paymentId)) {
    console.log(`[paystack-webhook] Duplicate - ${paymentId} already processed, skipping`);
    return new Response('OK', { status: 200 });
  }

  const is4Month = itemName.includes('4-Month');

  waitUntil((async () => {
    const failures: string[] = [];
    const ref = paymentId; // shorthand for log prefix

    // 1. Finance entry — idempotency anchor; if this fails everything re-runs on replay
    try {
      await createFinanceEntry({ name, email, amount: amountRands, paymentId, itemName, paymentType });
    } catch (e: any) {
      failures.push('finance-entry');
      console.error(`[paystack-webhook] [${ref}] Finance entry failed:`, e.message);
    }

    // 2. CRM status update — returns page ID we need to write portal result back
    let crmPageId: string | null = null;
    try {
      crmPageId = await updateCRMPaymentStatus(email, paymentType);
      if (!crmPageId && paymentType !== 'Other') {
        failures.push('crm-record-not-found');
        console.warn(`[paystack-webhook] [${ref}] No CRM record found for ${email}`);
      }
    } catch (e: any) {
      failures.push('crm-update');
      console.error(`[paystack-webhook] [${ref}] CRM update failed:`, e.message);
    }

    if (paymentType === 'Membership') {
      // 3. Portal provision
      let portalResult: { id: string; created: boolean } | null = null;
      try {
        portalResult = await provisionPortalAccount(email, name);
        if (portalResult) {
          console.log(`[paystack-webhook] [${ref}] Portal ${portalResult.created ? 'created' : 'already existed'} for ${email}`);
        } else {
          console.warn(`[paystack-webhook] [${ref}] Portal provision skipped — MEMBERS_API_TOKEN not set`);
        }
      } catch (e: any) {
        failures.push('portal-provision');
        console.error(`[paystack-webhook] [${ref}] Portal provision failed:`, e.message);
      }

      // 4. Write portal result back to CRM so we have a record of provisioning
      if (portalResult && crmPageId) {
        try {
          await patchPortalProvisioned(crmPageId, portalResult.id);
        } catch (e: any) {
          failures.push('portal-crm-patch');
          console.error(`[paystack-webhook] [${ref}] Portal CRM patch failed:`, e.message);
        }
      }

      // 5. Onboarding email
      // Send only when account was newly created — prevents re-send on webhook replay
      // when portal.created === false the account already existed (replayed webhook)
      // when portalResult is null (provision failed/skipped) still send so member hears something
      const shouldEmail = portalResult === null || portalResult.created === true;
      if (shouldEmail) {
        try {
          await sendPaymentConfirmation(email, firstName, paymentType, itemName);
        } catch (e: any) {
          failures.push('onboarding-email');
          console.error(`[paystack-webhook] [${ref}] Onboarding email failed:`, e.message);
        }
      }

    } else {
      // Non-membership: event confirmation
      try {
        await sendPaymentConfirmation(email, firstName, paymentType, itemName);
      } catch (e: any) {
        failures.push('event-email');
        console.error(`[paystack-webhook] [${ref}] Event email failed:`, e.message);
      }
    }

    // 6. Slack payment notification
    try {
      await postWebhook(SLACK_FINANCE_URL, `<!channel> 💰 *New Payment (Paystack) - R${amountRands}*\n*${name}* (${email})\n*Type:* ${paymentType} | *Item:* ${itemName}\n*Ref:* ${paymentId}`);
    } catch (e: any) {
      console.error(`[paystack-webhook] [${ref}] Slack notify failed:`, e.message);
    }

    // 7. 4-month renewal tag
    if (is4Month) {
      try {
        await tag4MonthRenewal(email, name);
      } catch (e: any) {
        failures.push('renewal-tag');
        console.error(`[paystack-webhook] [${ref}] Renewal tag failed:`, e.message);
      }
    }

    // 8. Alert Slack if anything needs manual recovery
    if (failures.length) {
      console.error(`[paystack-webhook] [${ref}] NEEDS RECOVERY — failed steps: ${failures.join(', ')}`);
      try {
        await postWebhook(SLACK_FINANCE_URL, `⚠️ *[NEEDS RECOVERY] Payment processed but steps failed*\n*Person:* ${name} (${email})\n*Ref:* ${paymentId} | *Type:* ${paymentType}\n*Failed:* ${failures.join(', ')}\nCheck Notion CRM and portal for this member.`);
      } catch {
        // Slack itself failed — at least it's in the Vercel logs
      }
    } else {
      console.log(`[paystack-webhook] [${ref}] All steps completed for ${name}`);
    }
  })());

  return new Response('OK', { status: 200 });
};
