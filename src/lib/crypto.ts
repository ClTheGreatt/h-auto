import { randomBytes } from "crypto";

export function generateApiKey(): string {
  // 32 random bytes → 64-char hex string
  return randomBytes(32).toString("hex");
}