import { Resend } from "resend";

// Lazy-load to avoid build errors when env vars aren't set
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set; emails will be logged only");
    return null;
  }
  return new Resend(apiKey);
}

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string; // plain-text fallback for clients that don't render HTML
};

/**
 * Send an email via Resend.
 * Returns { success: true } or { error: string }.
 * Never throws; caller can decide whether to fail or continue.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailParams): Promise<{ success: true } | { error: string }> {
  const resend = getResendClient();
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const fromName = process.env.EMAIL_FROM_NAME ?? "H-Auto";

  // Dev/test mode: no API key, just log.
  if (!resend) {
    console.log("[email:mock] Would send email:");
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Preview: ${html.substring(0, 200)}...`);
    return { success: true };
  }

  try {
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, ""), // basic HTML stripping
    });

    if (result.error) {
      console.error("[email] Resend error:", result.error);
      return { error: result.error.message ?? "Failed to send email" };
    }

    console.log(`[email] Sent to ${to} (id: ${result.data?.id})`);
    return { success: true };
  } catch (error) {
    console.error("[email] Exception:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
