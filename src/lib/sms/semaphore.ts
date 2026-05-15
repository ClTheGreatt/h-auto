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

    const data = await response.json();

    if (Array.isArray(data) && data[0]?.message_id) {
      return { success: true, messageId: String(data[0].message_id) };
    }
    return {
      success: false,
      error: data[0]?.message ?? "Unknown response from Semaphore",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}