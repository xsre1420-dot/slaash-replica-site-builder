import type { BackgroundJob, QueueConfig, QueueKind, QueueMetrics } from '@/background/shared/types';
import { getProcessor } from '@/background/processors/registry';
import { shouldSkipDuplicate, markIdempotencyComplete } from '@/background/shared/idempotency';
import { nextScheduledAt } from '@/background/retry/backoff';
import { pushToDeadLetter } from '@/background/retry/deadLetterQueue';
import { persistPendingJobs } from '@/background/shared/jobPersistence';
import { logger } from '@/lib/observability';

const pending: BackgroundJob[] = [];
const processing = new Set<string>();
const completedByQueue = new Map<QueueKind, number>();
const failedByQueue = new Map<QueueKind, number>();
const retryByQueue = new Map<QueueKind, number>();
const executionTimesByQueue = new Map<QueueKind, number[]>();
const processedTimestamps: number[] = [];
let lastHeartbeatAt: number | null = null;
let workerRunning = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const QUEUE_CONFIGS: Record<QueueKind, QueueConfig> = {
  orders: { kind: 'orders', maxConcurrency: 1, defaultMaxAttempts: 4, pollIntervalMs: 250 },
  inventory: { kind: 'inventory', maxConcurrency: 2, defaultMaxAttempts: 3, pollIntervalMs: 300 },
  notifications: { kind: 'notifications', maxConcurrency: 2, defaultMaxAttempts: 5, pollIntervalMs: 500 },
  analytics: { kind: 'analytics', maxConcurrency: 3, defaultMaxAttempts: 3, pollIntervalMs: 200 },
  import: { kind: 'import', maxConcurrency: 1, defaultMaxAttempts: 3, pollIntervalMs: 1000 },
  export: { kind: 'export', maxConcurrency: 1, defaultMaxAttempts: 3, pollIntervalMs: 1000 },
  image: { kind: 'image', maxConcurrency: 1, defaultMaxAttempts: 3, pollIntervalMs: 400 },
  webhook: { kind: 'webhook', maxConcurrency: 2, defaultMaxAttempts: 5, pollIntervalMs: 500 },
  cache: { kind: 'cache', maxConcurrency: 2, defaultMaxAttempts: 4, pollIntervalMs: 150 },
  search: { kind: 'search', maxConcurrency: 1, defaultMaxAttempts: 3, pollIntervalMs: 500 },
};

function jobKey(job: BackgroundJob): string {
  return `${job.queue}:${job.id}`;
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistPendingJobs(pending);
  }, 300);
}

export function restoreJobs(jobs: BackgroundJob[]): void {
  for (const job of jobs) {
    if (pending.some((p) => p.id === job.id)) continue;
    pending.push({ ...job, status: 'pending', startedAt: undefined });
  }
  pending.sort((a, b) => a.scheduledAt - b.scheduledAt);
}

export function enqueueJob<T>(
  queue: QueueKind,
  type: string,
  payload: T,
  options?: { idempotencyKey?: string; maxAttempts?: number; delayMs?: number }
): string {
  const config = QUEUE_CONFIGS[queue];
  const id = `${queue}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();

  if (options?.idempotencyKey && shouldSkipDuplicate(options.idempotencyKey)) {
    return id;
  }

  const job: BackgroundJob<T> = {
    id,
    queue,
    type,
    payload,
    idempotencyKey: options?.idempotencyKey,
    status: 'pending',
    attempts: 0,
    maxAttempts: options?.maxAttempts ?? config.defaultMaxAttempts,
    createdAt: now,
    scheduledAt: now + (options?.delayMs ?? 0),
  };

  pending.push(job);
  pending.sort((a, b) => a.scheduledAt - b.scheduledAt);
  schedulePersist();
  return id;
}

function countByQueue(kind: QueueKind, status: 'pending' | 'processing'): number {
  if (status === 'pending') return pending.filter((j) => j.queue === kind).length;
  return [...processing].filter((k) => k.startsWith(`${kind}:`)).length;
}

function recordExecution(queue: QueueKind, durationMs: number): void {
  const times = executionTimesByQueue.get(queue) ?? [];
  times.push(durationMs);
  if (times.length > 50) times.shift();
  executionTimesByQueue.set(queue, times);
}

function processingRatePerMin(): number {
  const cutoff = Date.now() - 60_000;
  while (processedTimestamps.length > 0 && processedTimestamps[0] < cutoff) {
    processedTimestamps.shift();
  }
  return processedTimestamps.length;
}

export function getQueueMetrics(kind: QueueKind): QueueMetrics {
  const now = Date.now();
  const queuePending = pending.filter((j) => j.queue === kind);
  const oldest = queuePending.length
    ? now - Math.min(...queuePending.map((j) => j.createdAt))
    : 0;
  const completed = completedByQueue.get(kind) ?? 0;
  const failed = failedByQueue.get(kind) ?? 0;
  const total = completed + failed || 1;
  const times = executionTimesByQueue.get(kind) ?? [];
  const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

  return {
    queue: kind,
    pending: queuePending.length,
    processing: countByQueue(kind, 'processing'),
    completed,
    failed,
    deadLetter: 0,
    avgExecutionMs: Math.round(avg),
    successRate: completed / total,
    retryCount: retryByQueue.get(kind) ?? 0,
    oldestPendingMs: oldest,
    workerActive: workerRunning,
    lastHeartbeatAt,
    processingRatePerMin: processingRatePerMin(),
    queueLatencyMs: oldest,
  };
}

export function getAllQueueMetrics(): QueueMetrics[] {
  return (Object.keys(QUEUE_CONFIGS) as QueueKind[]).map(getQueueMetrics);
}

export async function processQueueTick(): Promise<number> {
  lastHeartbeatAt = Date.now();
  let processed = 0;
  const now = Date.now();

  for (const kind of Object.keys(QUEUE_CONFIGS) as QueueKind[]) {
    const config = QUEUE_CONFIGS[kind];
    const active = countByQueue(kind, 'processing');
    if (active >= config.maxConcurrency) continue;

    const slot = config.maxConcurrency - active;
    const ready = pending.filter(
      (j) => j.queue === kind && j.scheduledAt <= now && !processing.has(jobKey(j))
    );

    for (const job of ready.slice(0, slot)) {
      await runJob(job);
      processed++;
      processedTimestamps.push(Date.now());
    }
  }

  if (processed > 0) schedulePersist();
  return processed;
}

async function runJob(job: BackgroundJob): Promise<void> {
  const key = jobKey(job);
  if (processing.has(key)) return;

  const processor = getProcessor(job.type);
  if (!processor) {
    logger.warn('background.job.no_processor', { type: job.type, queue: job.queue });
    removePending(job.id);
    schedulePersist();
    return;
  }

  processing.add(key);
  job.status = 'processing';
  job.attempts += 1;
  job.startedAt = Date.now();

  try {
    await processor(job);
    job.status = 'completed';
    job.completedAt = Date.now();
    const duration = job.completedAt - (job.startedAt ?? job.completedAt);
    recordExecution(job.queue, duration);
    completedByQueue.set(job.queue, (completedByQueue.get(job.queue) ?? 0) + 1);
    markIdempotencyComplete(job.idempotencyKey);
    removePending(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.lastError = message;
    job.status = 'failed';

    if (job.attempts >= job.maxAttempts) {
      pushToDeadLetter(job);
      failedByQueue.set(job.queue, (failedByQueue.get(job.queue) ?? 0) + 1);
      removePending(job.id);
      logger.error('background.job.dead_letter', {
        id: job.id,
        queue: job.queue,
        type: job.type,
        attempts: job.attempts,
        error: message,
      });
    } else {
      retryByQueue.set(job.queue, (retryByQueue.get(job.queue) ?? 0) + 1);
      job.status = 'pending';
      job.scheduledAt = nextScheduledAt(job.attempts);
      logger.warn('background.job.retry', {
        id: job.id,
        queue: job.queue,
        type: job.type,
        attempt: job.attempts,
        nextAt: job.scheduledAt,
        error: message,
      });
    }
  } finally {
    processing.delete(key);
    schedulePersist();
  }
}

function removePending(id: string): void {
  const idx = pending.findIndex((j) => j.id === id);
  if (idx >= 0) pending.splice(idx, 1);
}

export function getPendingJobs(): BackgroundJob[] {
  return [...pending];
}

export function setWorkerRunning(active: boolean): void {
  workerRunning = active;
}

export function resetQueuesForTests(): void {
  pending.length = 0;
  processing.clear();
  completedByQueue.clear();
  failedByQueue.clear();
  retryByQueue.clear();
  executionTimesByQueue.clear();
  processedTimestamps.length = 0;
  workerRunning = false;
  lastHeartbeatAt = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}
