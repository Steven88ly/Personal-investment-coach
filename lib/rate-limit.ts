/**
 * Sliding-window limiter, in memory. Fine for a one-user demo; on Vercel each
 * server instance keeps its own window, so treat limits as per instance.
 */
export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }) {
  const { limit, windowMs, now = Date.now } = opts;
  const hits = new Map<string, number[]>();
  return {
    allow(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      return true;
    },
  };
}

/** Client key for limits: Vercel sets x-forwarded-for to the real client IP. */
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

/**
 * Daily cap on live model calls (cost control, OWASP API4). Resets at UTC
 * midnight. Per instance, like the limiter above.
 */
export function createDailyBudget(opts: { limit: number; now?: () => number }) {
  const { limit, now = Date.now } = opts;
  let day = "";
  let used = 0;
  return {
    take(): boolean {
      const today = new Date(now()).toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        used = 0;
      }
      if (used >= limit) return false;
      used++;
      return true;
    },
  };
}
