const BASE_MS = 500;
const MAX_MS = 60_000;
const JITTER_RATIO = 0.2;

/** Exponential backoff with jitter — attempt is 1-based. */
export function computeBackoffMs(attempt: number): number {
  const exp = Math.min(BASE_MS * 2 ** (attempt - 1), MAX_MS);
  const jitter = exp * JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(100, Math.min(MAX_MS, Math.round(exp + jitter)));
}

export function nextScheduledAt(attempt: number, fromMs = Date.now()): number {
  return fromMs + computeBackoffMs(attempt);
}
