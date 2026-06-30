/**
 * Failure isolation — non-critical subsystems must not block checkout or orders.
 */
import type { QueueKind } from '@/background/shared/types';
import { logger } from '@/lib/observability';

export type SubsystemCriticality = 'critical' | 'standard' | 'best_effort';

export type SubsystemDefinition = {
  id: string;
  criticality: SubsystemCriticality;
  queues: QueueKind[];
  /** RPC circuit breaker namespace prefix */
  breakerPrefix?: string;
};

export const SUBSYSTEM_REGISTRY: SubsystemDefinition[] = [
  { id: 'checkout', criticality: 'critical', queues: ['orders'], breakerPrefix: 'rpc:create_order' },
  { id: 'payments', criticality: 'critical', queues: ['orders'], breakerPrefix: 'rpc:payment' },
  { id: 'inventory', criticality: 'critical', queues: ['inventory'] },
  { id: 'storefront', criticality: 'standard', queues: ['cache', 'search'] },
  { id: 'analytics', criticality: 'best_effort', queues: ['analytics'], breakerPrefix: 'rpc:track' },
  { id: 'notifications', criticality: 'best_effort', queues: ['notifications', 'webhook'] },
  { id: 'imports', criticality: 'best_effort', queues: ['import'] },
  { id: 'exports', criticality: 'best_effort', queues: ['export'] },
  { id: 'media', criticality: 'best_effort', queues: ['image'] },
];

export function getSubsystemForQueue(queue: QueueKind): SubsystemDefinition | undefined {
  return SUBSYSTEM_REGISTRY.find((s) => s.queues.includes(queue));
}

export function isBestEffortQueue(queue: QueueKind): boolean {
  const sub = getSubsystemForQueue(queue);
  return sub?.criticality === 'best_effort';
}

export type IsolatedResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; isolated: true };

/**
 * Run a non-critical operation without propagating failures to callers.
 * Checkout and order paths must never depend on the return value blocking.
 */
export async function runIsolatedSubsystem<T>(
  subsystemId: string,
  fn: () => Promise<T>,
  fallback?: T
): Promise<IsolatedResult<T>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('subsystem.isolated_failure', { subsystemId, error: message });
    if (fallback !== undefined) {
      return { ok: false, error: message, isolated: true };
    }
    return { ok: false, error: message, isolated: true };
  }
}

/** Safe enqueue wrapper — never throws for best-effort subsystems. */
export function safeEnqueueBestEffort(subsystemId: string, enqueueFn: () => string): string {
  try {
    return enqueueFn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('subsystem.enqueue_failed', { subsystemId, error: message });
    return '';
  }
}
