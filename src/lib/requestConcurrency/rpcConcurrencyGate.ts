import type { RpcTrafficClass } from '@/lib/requestConcurrency/rpcTrafficClass';

type WaitEntry = {
  trafficClass: RpcTrafficClass;
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort: () => void;
};

/** Per-tab RPC concurrency limits — critical storefront paths stay reserved under pressure. */
const LIMITS: Record<RpcTrafficClass, { maxConcurrent: number; maxQueued: number }> = {
  critical: { maxConcurrent: 4, maxQueued: 48 },
  standard: { maxConcurrent: 2, maxQueued: 16 },
  background: { maxConcurrent: 1, maxQueued: 4 },
};

/** Hard cap on simultaneous outbound PostgREST RPC fetches in one browser tab. */
const TOTAL_MAX_INFLIGHT = 6;

/** Reserve capacity so analytics cannot consume the last slots during spikes. */
const CRITICAL_RESERVE = 2;

const PRIORITY: Record<RpcTrafficClass, number> = {
  critical: 0,
  standard: 1,
  background: 2,
};

let totalInflight = 0;
const inflightByClass: Record<RpcTrafficClass, number> = {
  critical: 0,
  standard: 0,
  background: 0,
};

const waitQueue: WaitEntry[] = [];

function hasAbortError(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted);
}

function removeWaitEntry(entry: WaitEntry): void {
  const idx = waitQueue.indexOf(entry);
  if (idx >= 0) waitQueue.splice(idx, 1);
  entry.signal?.removeEventListener('abort', entry.onAbort);
}

function criticalWaitingCount(): number {
  return waitQueue.filter((entry) => entry.trafficClass === 'critical').length;
}

function queuedCount(trafficClass: RpcTrafficClass): number {
  return waitQueue.filter((entry) => entry.trafficClass === trafficClass).length;
}

function canStart(trafficClass: RpcTrafficClass): boolean {
  if (totalInflight >= TOTAL_MAX_INFLIGHT) return false;
  if (inflightByClass[trafficClass] >= LIMITS[trafficClass].maxConcurrent) return false;

  if (trafficClass === 'background') {
    if (criticalWaitingCount() > 0) return false;
    if (totalInflight >= TOTAL_MAX_INFLIGHT - CRITICAL_RESERVE) return false;
  }

  if (trafficClass === 'standard' && totalInflight >= TOTAL_MAX_INFLIGHT - 1) {
    return criticalWaitingCount() === 0;
  }

  return true;
}

function drainQueue(): void {
  const pending = [...waitQueue].sort(
    (a, b) => PRIORITY[a.trafficClass] - PRIORITY[b.trafficClass]
  );

  for (const entry of pending) {
    if (hasAbortError(entry.signal)) continue;
    if (!canStart(entry.trafficClass)) continue;

    removeWaitEntry(entry);
    totalInflight += 1;
    inflightByClass[entry.trafficClass] += 1;

    entry.resolve(() => {
      totalInflight = Math.max(0, totalInflight - 1);
      inflightByClass[entry.trafficClass] = Math.max(0, inflightByClass[entry.trafficClass] - 1);
      drainQueue();
    });
  }
}

export class RpcConcurrencyRejectedError extends Error {
  constructor(message = 'RPC concurrency queue saturated') {
    super(message);
    this.name = 'RpcConcurrencyRejectedError';
  }
}

/** Acquire an RPC slot; returns a release function that must run in finally. */
export function acquireRpcSlot(
  trafficClass: RpcTrafficClass,
  signal?: AbortSignal
): Promise<() => void> {
  if (hasAbortError(signal)) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  if (canStart(trafficClass)) {
    totalInflight += 1;
    inflightByClass[trafficClass] += 1;
    return Promise.resolve(() => {
      totalInflight = Math.max(0, totalInflight - 1);
      inflightByClass[trafficClass] = Math.max(0, inflightByClass[trafficClass] - 1);
      drainQueue();
    });
  }

  // Analytics / visit tracking must not pile up under pressure.
  if (trafficClass === 'background') {
    return Promise.reject(new RpcConcurrencyRejectedError('analytics deferred under load'));
  }

  if (queuedCount(trafficClass) >= LIMITS[trafficClass].maxQueued) {
    return Promise.reject(new RpcConcurrencyRejectedError());
  }

  return new Promise((resolve, reject) => {
    const entry: WaitEntry = {
      trafficClass,
      resolve,
      reject,
      signal,
      onAbort: () => {
        removeWaitEntry(entry);
        reject(new DOMException('Aborted', 'AbortError'));
        drainQueue();
      },
    };

    if (signal) {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', entry.onAbort, { once: true });
    }

    waitQueue.push(entry);
    drainQueue();
  });
}

/** Test-only reset. */
export function resetRpcConcurrencyGateForTests(): void {
  totalInflight = 0;
  inflightByClass.critical = 0;
  inflightByClass.standard = 0;
  inflightByClass.background = 0;
  waitQueue.splice(0, waitQueue.length);
}

export function getRpcConcurrencySnapshot(): {
  totalInflight: number;
  inflightByClass: Record<RpcTrafficClass, number>;
  queued: number;
} {
  return {
    totalInflight,
    inflightByClass: { ...inflightByClass },
    queued: waitQueue.length,
  };
}
