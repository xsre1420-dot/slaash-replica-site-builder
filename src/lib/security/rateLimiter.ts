/**
 * Client-side rate limiter for sensitive flows (login, checkout).
 * Complements server-side limits; not a substitute for edge/DB enforcement.
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

export const RATE_LIMITS = {
  login: { maxRequests: 8, windowMs: 5 * 60 * 1000 },
  accessCode: { maxRequests: 5, windowMs: 10 * 60 * 1000 },
  checkout: { maxRequests: 5, windowMs: 60 * 1000 },
} as const;

export class RateLimitExceededError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super('rate_limit_exceeded');
    this.name = 'RateLimitExceededError';
    this.retryAfterMs = retryAfterMs;
  }
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

export const enforceRateLimit = (key: string, options: RateLimitOptions): void => {
  const { allowed, retryAfterMs } = checkRateLimit(key, options);
  if (!allowed) {
    throw new RateLimitExceededError(retryAfterMs);
  }
};

export const formatRateLimitMessageAr = (retryAfterMs: number): string => {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `محاولات كثيرة — انتظر ${minutes} دقيقة ثم حاول مرة أخرى`;
  }
  return `محاولات كثيرة — انتظر ${seconds} ثانية ثم حاول مرة أخرى`;
};

export const withRateLimit = async <T>(
  key: string,
  options: RateLimitOptions,
  fn: () => Promise<T>
): Promise<T> => {
  enforceRateLimit(key, options);
  return fn();
};
