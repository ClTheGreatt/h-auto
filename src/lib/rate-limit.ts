type Entry = { count: number; windowStart: number };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Mirrors the globalThis-singleton pattern used for the Prisma client
// (src/lib/prisma.ts) so the Map survives Next.js dev-mode HMR instead of
// resetting on every file save.
//
// In-memory only: this is a per-instance, soft rate limit. On a
// multi-instance deployment (e.g. Vercel with more than one warm lambda) an
// attacker distributed across instances could exceed the nominal limit, and
// every counter resets on redeploy/cold start. Acceptable for a capstone
// project; a production system would back this with Redis/Upstash instead.
const globalForRateLimit = globalThis as unknown as {
  loginAttempts: Map<string, Entry> | undefined;
};
const attempts = globalForRateLimit.loginAttempts ?? new Map<string, Entry>();
globalForRateLimit.loginAttempts = attempts;

function isExpired(entry: Entry, now: number): boolean {
  return now - entry.windowStart > WINDOW_MS;
}

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || isExpired(entry, now)) {
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
  return {
    allowed: entry.count < MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - entry.count),
  };
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || isExpired(entry, now)) {
    attempts.set(key, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

export function resetRateLimit(key: string): void {
  attempts.delete(key);
}

// Minutes remaining until this key's current window expires (ceil'd for
// user-facing messaging, e.g. "try again in about N minutes").
export function retryAfterMinutes(key: string): number {
  const entry = attempts.get(key);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.windowStart;
  const remainingMs = Math.max(0, WINDOW_MS - elapsed);
  return Math.ceil(remainingMs / (60 * 1000));
}

// x-forwarded-for may carry a comma-separated proxy chain; the first entry
// is the original client. Falls back to x-real-ip, then "unknown" (still a
// valid rate-limit key — it just groups all IP-less requests together).
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
