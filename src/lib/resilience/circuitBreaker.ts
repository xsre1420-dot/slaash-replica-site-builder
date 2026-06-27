/**
 * Lightweight in-process circuit breaker for downstream calls (RPC, edge, fetch).
 * State is per-tab — use with shared KV for fleet-wide breakers when configured.
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  successThreshold?: number;
  openMs?: number;
  name?: string;
};

type BreakerRecord = {
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: number;
  lastError: string | null;
};

const breakers = new Map<string, BreakerRecord>();

const DEFAULTS = {
  failureThreshold: 5,
  successThreshold: 2,
  openMs: 15_000,
};

function getRecord(name: string): BreakerRecord {
  let rec = breakers.get(name);
  if (!rec) {
    rec = { state: 'closed', failures: 0, successes: 0, openedAt: 0, lastError: null };
    breakers.set(name, rec);
  }
  return rec;
}

export function getCircuitBreakerStatus(name: string): {
  name: string;
  state: CircuitState;
  failures: number;
  lastError: string | null;
} {
  const rec = getRecord(name);
  return { name, state: rec.state, failures: rec.failures, lastError: rec.lastError };
}

export function getAllCircuitBreakerStatuses(): ReturnType<typeof getCircuitBreakerStatus>[] {
  return [...breakers.keys()].map(getCircuitBreakerStatus);
}

export function resetCircuitBreaker(name: string): void {
  breakers.delete(name);
}

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  opts: CircuitBreakerOptions = {}
): Promise<T> {
  const failureThreshold = opts.failureThreshold ?? DEFAULTS.failureThreshold;
  const successThreshold = opts.successThreshold ?? DEFAULTS.successThreshold;
  const openMs = opts.openMs ?? DEFAULTS.openMs;
  const rec = getRecord(name);

  if (rec.state === 'open') {
    if (Date.now() - rec.openedAt >= openMs) {
      rec.state = 'half_open';
      rec.successes = 0;
    } else {
      throw new Error(`circuit_open:${name}`);
    }
  }

  try {
    const result = await fn();
    if (rec.state === 'half_open') {
      rec.successes += 1;
      if (rec.successes >= successThreshold) {
        rec.state = 'closed';
        rec.failures = 0;
        rec.successes = 0;
        rec.lastError = null;
      }
    } else {
      rec.failures = 0;
      rec.lastError = null;
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rec.lastError = message;
    rec.failures += 1;
    if (rec.state === 'half_open' || rec.failures >= failureThreshold) {
      rec.state = 'open';
      rec.openedAt = Date.now();
      rec.successes = 0;
    }
    throw err;
  }
}
