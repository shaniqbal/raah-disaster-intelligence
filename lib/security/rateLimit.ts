/**
 * Best-effort in-memory fixed-window rate limiter. On serverless platforms each
 * instance keeps its own window, so this limits bursts rather than guaranteeing
 * a global quota — documented in SECURITY.md.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000, now = Date.now()): { ok: boolean; retryAfterS: number } {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return { ok: true, retryAfterS: 0 };
  }
  b.count++;
  return b.count <= limit ? { ok: true, retryAfterS: 0 } : { ok: false, retryAfterS: Math.ceil((b.resetAt - now) / 1000) };
}
