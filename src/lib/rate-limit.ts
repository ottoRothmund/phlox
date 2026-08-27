export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface FixedWindowOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createFixedWindowRateLimiter({
  limit,
  windowMs,
  maxKeys = 1_000,
}: FixedWindowOptions) {
  const buckets = new Map<string, Bucket>();

  return (key: string, now = Date.now()): RateLimitDecision => {
    const existing = buckets.get(key);
    const bucket =
      !existing || now >= existing.resetAt
        ? { count: 0, resetAt: now + windowMs }
        : existing;

    if (bucket.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1_000),
        ),
      };
    }

    bucket.count += 1;
    buckets.delete(key);
    buckets.set(key, bucket);

    if (buckets.size > maxKeys) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }

    return {
      allowed: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1_000),
      ),
    };
  };
}
