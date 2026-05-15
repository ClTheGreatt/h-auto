/**
 * Normalize a Philippine phone number to E.164 format (639xxxxxxxxx).
 * Accepts: 09171234567, +639171234567, 639171234567, 9171234567
 */
export function normalizePhPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 11 && cleaned.startsWith("09")) {
    return "63" + cleaned.substring(1);
  }
  if (cleaned.length === 12 && cleaned.startsWith("63")) {
    return cleaned;
  }
  if (cleaned.length === 10 && cleaned.startsWith("9")) {
    return "63" + cleaned;
  }

  return null;
}