import { normalizePhPhone } from "./phone";

const TEXTBEE_API_URL = "https://api.textbee.dev/api/v1/gateway/send-sms";

// The contract every SMS provider in this module must return —
// src/lib/alerts/processor.ts depends on this shape exactly.
export type SendResult = {
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

  // textbee requires E.164 WITH a leading "+" (verified working format:
  // +639636089781). normalizePhPhone returns digits only (639XXXXXXXXX,
  // no plus) — the plus is added here at the call site rather than in
  // normalizePhPhone itself, since other code may depend on its current
  // (no-plus) output.
  const recipient = `+${normalized}`;

  const apiKey = process.env.TEXTBEE_API_KEY;

  // Mock mode for development — same contract/behavior as the Semaphore
  // version this replaces.
  if (!apiKey || apiKey.startsWith("test_")) {
    console.log(`\n[MOCK SMS] → ${recipient}\n${message}\n`);
    return {
      success: true,
      messageId: "mock-" + Date.now(),
      mock: true,
    };
  }

  // Real textbee call — account-level send-sms endpoint, no device id
  // required. Verified request shape (a real SMS was delivered in ~5s
  // using exactly this payload):
  //   POST https://api.textbee.dev/api/v1/gateway/send-sms
  //   headers: { x-api-key, Content-Type: application/json }
  //   body: { recipients: ["+639XXXXXXXXX"], message: "..." }
  try {
    const response = await fetch(TEXTBEE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipients: [recipient],
        message,
      }),
    });

    const rawBody = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(rawBody);
    } catch {
      console.error(
        `[sms] textbee returned non-JSON response (status ${response.status}): ${rawBody.slice(0, 500)}`
      );
      return {
        success: false,
        error: `textbee error (status ${response.status}): ${
          rawBody.slice(0, 200) || "empty response"
        }`,
      };
    }

    // Unlike Semaphore (which signals success/failure via response shape,
    // never HTTP status), textbee's documented error shape carries its own
    // statusCode field alongside message/error — a conventional REST API
    // where the HTTP status itself is the success signal.
    if (!response.ok) {
      console.error(
        `[sms] textbee send failed (status ${response.status}): ${rawBody.slice(0, 500)}`
      );
      return {
        success: false,
        error: extractTextbeeError(data, response.status),
      };
    }

    return {
      success: true,
      messageId: extractTextbeeMessageId(data),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

// textbee's documented error shape: { message, error, statusCode }. Prefer
// the human-readable `message`, fall back to `error`, then a generic string
// carrying the HTTP status. Never logs apiKey — only the response body.
function extractTextbeeError(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
  }
  return `textbee error (status ${status}): ${JSON.stringify(data).slice(0, 200)}`;
}

// UNVERIFIED: no example of textbee's success response body was provided
// (only the request shape and the error shape were verified/documented).
// Tries a few conventional id field names; if none are present this
// returns undefined rather than inventing a value — messageId is already
// optional in SendResult, so a miss here degrades gracefully to a null
// providerMessageId, not a broken contract.
function extractTextbeeMessageId(data: unknown): string | undefined {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidate = obj.messageId ?? obj.id ?? obj._id;
    if (typeof candidate === "string") return candidate;
    if (typeof candidate === "number") return String(candidate);
  }
  return undefined;
}
