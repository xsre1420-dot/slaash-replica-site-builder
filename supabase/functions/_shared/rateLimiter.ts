/** In-memory rate limiter for edge functions (per isolate). */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export const checkEdgeRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= maxRequests) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
};

export const clientIpFromRequest = (req: Request): string => {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip')?.trim();
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  return forwarded || realIp || cfIp || 'unknown';
};
