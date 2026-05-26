// Expo push notifications — best-effort sender.
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  priority?: "high" | "default";
};

export async function sendExpoPush(
  messages: ExpoMessage[]
): Promise<{ success: boolean; error?: string }> {
  if (messages.length === 0) return { success: true };

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Expo push HTTP ${res.status}: ${text}` };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Expo push failed",
    };
  }
}