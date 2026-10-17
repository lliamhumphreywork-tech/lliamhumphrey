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
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" type="text/css" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'DM Sans',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f4">
  <tr>
    <td align="center" valign="top" style="padding:32px 16px">
      <table width="480" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden">
        <tr>
          <td style="padding:28px 40px;border-bottom:1px solid #e8e8e8">
            <span style="font-family:'Syne',Georgia,serif;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0a0a0a">Private Victories</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px">
            <h1 style="font-family:'Syne',Georgia,serif;font-size:24px;font-weight:800;line-height:1.25;color:#0a0a0a;margin:0 0 16px">Your sign-in link</h1>
            <p style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.7;color:#0a0a0a;margin:0 0 28px">Click the button below to access your members portal. This link expires in 24 hours and can only be used once.</p>
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-radius:4px;background-color:#0a0a0a">
                  <a href="${url}" style="font-family:'Syne',Georgia,serif;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#ffffff;text-decoration:none;padding:14px 28px;display:inline-block;border-radius:4px">Access Portal</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 40px;border-top:1px solid #e8e8e8;background-color:#f7f7f7">
            <p style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;line-height:1.6;color:#9ca3af;margin:0">If you didn't request this link, you can safely ignore this email. Your account remains secure.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
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
