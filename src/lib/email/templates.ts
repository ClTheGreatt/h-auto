type WelcomeEmailParams = {
  firstName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  role: string;
};

/**
 * Generate HTML for the welcome email sent when a new user is created.
 * Inline styles only — email clients strip <style> tags.
 */
export function welcomeEmailTemplate({
  firstName,
  email,
  tempPassword,
  loginUrl,
  role,
}: WelcomeEmailParams): { subject: string; html: string; text: string } {
  const roleLabel = role
    .toLowerCase()
    .replace("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const subject = "Welcome to H-Auto — Your account is ready";

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);padding:32px 32px 28px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;background-color:rgba(255,255,255,0.2);border-radius:14px;line-height:56px;font-size:28px;">🌱</div>
              <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:16px 0 4px;">H-Auto</h1>
              <p style="color:#dcfce7;font-size:14px;margin:0;">Smart Gardening Monitoring System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="color:#111827;font-size:20px;font-weight:600;margin:0 0 16px;">
                Hello, ${firstName}! 👋
              </h2>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
                Your H-Auto account has been created by an administrator. You can now log in
                as a <strong>${roleLabel}</strong> using the credentials below.
              </p>

              <!-- Credentials box -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:24px 0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Email</p>
                    <p style="color:#111827;font-size:15px;font-family:'Courier New',monospace;margin:0 0 16px;">${email}</p>
                    
                    <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Temporary Password</p>
                    <p style="color:#111827;font-size:15px;font-family:'Courier New',monospace;background-color:#fef3c7;display:inline-block;padding:4px 10px;border-radius:4px;margin:0;">${tempPassword}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${loginUrl}" style="display:inline-block;background-color:#16a34a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      Log in to H-Auto
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security note -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;margin:16px 0 0;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="color:#78350f;font-size:13px;line-height:1.5;margin:0;">
                      <strong>🔒 Security tip:</strong> For your protection, please change your password
                      after first login. If you did not expect this email, contact your administrator immediately.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="color:#6b7280;font-size:12px;margin:0 0 4px;">
                H-Auto Smart Gardening Monitoring System
              </p>
              <p style="color:#9ca3af;font-size:11px;margin:0;">
                Bataan Peninsula State University · College of Computer Studies
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  const text = `
Hello, ${firstName}!

Your H-Auto account has been created. You can now log in as a ${roleLabel}.

Email: ${email}
Temporary Password: ${tempPassword}

Log in here: ${loginUrl}

For your protection, please change your password after first login.

— H-Auto Smart Gardening Team
Bataan Peninsula State University
`.trim();

  return { subject, html, text };
}