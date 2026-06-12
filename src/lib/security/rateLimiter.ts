/**
 * Phase 14: Client-side rate limiter for API calls
 */

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export const checkRateLimit = (
  key: string,
  { maxRequests, windowMs }: RateLimitOptions
): { allowed: boolean; retryAfterMs: number } => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= maxRequests) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
};

export const withRateLimit = async <T>(
  key: string,
  options: RateLimitOptions,
  fn: () => Promise<T>
): Promise<T> => {
  const { allowed, retryAfterMs } = checkRateLimit(key, options);
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Retry in ${Math.ceil(retryAfterMs / 1000)}s`);
  }
  return fn();
};
