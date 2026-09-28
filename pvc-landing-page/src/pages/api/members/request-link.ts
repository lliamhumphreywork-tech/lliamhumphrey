export const prerender = false;
import type { APIRoute } from 'astro';
import { generateMagicToken } from '../../../lib/members-auth';

const BREVO_API_KEY = import.meta.env.BREVO_API_KEY;
const SITE_URL = import.meta.env.SITE_URL ?? 'https://privatevictoriesclub.com';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const email = (body.email ?? '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
  }

  const token = generateMagicToken(email);
  const link = `${SITE_URL}/api/members/verify?token=${encodeURIComponent(token)}`;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Private Victories Club', email: 'lliam@privatevictoriesclub.com' },
      to: [{ email }],
      subject: 'Your PVC member login link',
      htmlContent: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#08111f;font-family:'DM Sans',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:52px 32px 64px;">
  <div style="font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#4a5666;margin-bottom:48px;">Private Victories Club</div>
  <p style="font-size:16px;font-weight:300;color:#ffffff;line-height:1.8;margin:0 0 36px;">Here's your login link for the member portal. It expires in 15 minutes.</p>
  <a href="${link}" style="display:inline-block;background:#a8b8c8;color:#08111f;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;padding:16px 36px;text-decoration:none;">Access Members Portal</a>
  <p style="font-size:12px;color:#4a5666;margin-top:36px;line-height:1.7;">If you didn't request this, ignore this email.</p>
</div></body></html>`,
    }),
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
