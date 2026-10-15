export async function sendMagicLink({
  email,
  url,
}: {
  email: string
  url: string
}) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_FROM_NAME ?? "Private Victories Club",
        email: process.env.BREVO_FROM_EMAIL ?? "lliam@privatevictoriesclub.com",
      },
      to: [{ email }],
      subject: "Your sign-in link for PVC Members",
      htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:52px 32px">
    <p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a8b8c8;margin:0 0 40px;font-weight:600">Private Victories Club</p>
    <h1 style="font-size:28px;font-weight:700;color:#f5f5f5;margin:0 0 14px;line-height:1.25;letter-spacing:-0.01em">Your sign-in link</h1>
    <p style="font-size:15px;line-height:1.75;color:#aaaaaa;margin:0 0 36px">Click the button below to access your members portal. This link expires in 24 hours and can only be used once.</p>
    <a href="${url}" style="display:inline-block;background:#c9a84c;color:#000000;padding:15px 36px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em;text-transform:uppercase">Access Portal</a>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #1e1e1e">
      <p style="font-size:12px;color:#555;margin:0;line-height:1.7">If you didn't request this link, you can safely ignore this email. Your account remains secure.</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    }),
  })

  const body = await res.text()
  if (!res.ok) {
    console.error(`[Brevo] Send failed (${res.status}):`, body)
    throw new Error(`Brevo send failed: ${body}`)
  }
  console.log(`[Brevo] Magic link sent to ${email}`)
}
