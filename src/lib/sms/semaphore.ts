import { normalizePhPhone } from "./phone";

const SEMAPHORE_API_URL = "https://api.semaphore.co/api/v4/messages";

type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  mock?: boolean;
};

export async function sendSMS(
  phoneNumber: string | null,
  message: string
): Promise<SendResult> {
  const normalized = normalizePhPhone(phoneNumber);
  if (!normalized) {
    return { success: false, error: "Invalid or missing phone number" };
  }

  const apiKey = process.env.SEMAPHORE_API_KEY;

  // Mock mode for development
  if (!apiKey || apiKey.startsWith("test_")) {
    console.log(`\n[MOCK SMS] → +${normalized}\n${message}\n`);
    return {
      success: true,
      messageId: "mock-" + Date.now(),
      mock: true,
    };
  }

  // Real Semaphore call
  try {
    const formData = new URLSearchParams();
    formData.append("apikey", apiKey);
    formData.append("number", normalized);
    formData.append("message", message);

    const response = await fetch(SEMAPHORE_API_URL, {
      method: "POST",
      body: formData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const rawBody = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch {
      console.error(
        `[sms] Semaphore returned non-JSON response (status ${response.status}): ${rawBody.slice(0, 500)}`
      );
      return {
        success: false,
        error: `Semaphore error (status ${response.status}): ${
          rawBody.slice(0, 200) || "empty response"
        }`,
      };
    }

    if (Array.isArray(data) && data[0]?.message_id) {
      return { success: true, messageId: String(data[0].message_id) };
    }

    // Not the success shape — Semaphore's error responses vary, so try
    // each known shape before falling back to a generic message. Never
    // log formData/apiKey here, only the response Semaphore sent back.
    console.error(
      `[sms] Semaphore send failed (status ${response.status}): ${rawBody.slice(0, 500)}`
    );
    return { success: false, error: extractSemaphoreError(data) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

// Semaphore's success shape is always an array of message objects. On
// failure it can be: an array whose first item carries an error/message
// field, a plain object with `message` or `error`, or a plain object of
// field -> validation-error-array (e.g. {"number": ["...required."]}).
function extractSemaphoreError(data: unknown): string {
  if (Array.isArray(data)) {
    const first = data[0] as Record<string, unknown> | undefined;
    if (typeof first?.message === "string") return first.message;
    if (typeof first?.error === "string") return first.error;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
    }
  }
  return `Unknown response from Semaphore: ${JSON.stringify(data).slice(0, 200)}`;
}