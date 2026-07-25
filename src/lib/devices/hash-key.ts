import { createHash } from "crypto";

// Device API keys are 48 hex chars of crypto-random entropy
// (randomBytes(24) in actions/devices.ts), not human-chosen passwords —
// bcrypt's deliberate slowness exists to resist brute-forcing low-entropy
// secrets, which doesn't apply here, and its per-hash salt would break the
// O(1) unique-indexed lookup /api/sensors/ingest depends on. SHA-256 is
// deterministic (same input always produces the same digest, so the
// findUnique({ where: { apiKeyHash } }) lookup still works) and more than
// sufficient for a key with this much entropy.
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
