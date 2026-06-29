import {
  processQueueTick,
  setWorkerRunning,
  getAllQueueMetrics,
  getPendingJobs,
  restoreJobs,
} from '@/background/queues/JobQueue';
import { getDeadLetterJobs } from '@/background/retry/deadLetterQueue';
import { registerAllProcessors } from '@/background/processors';
import { restorePendingJobs } from '@/background/shared/jobPersistence';
import type { ClientBackgroundStatus, QueueKind } from '@/background/shared/types';
import { logger } from '@/lib/observability';

let intervalId: ReturnType<typeof setInterval> | null = null;
let startedAt = 0;
let shuttingDown = false;

const SLOW_JOB_MS = 3000;

async function restorePersistedJobs(): Promise<void> {
  const jobs = await restorePendingJobs();
  if (jobs.length > 0) {
    restoreJobs(jobs);
    logger.info('background.jobs.restored', { count: jobs.length });
  }
}

export function startBackgroundWorkers(): void {
  if (typeof window === 'undefined') return;
  if (intervalId != null) return;

  registerAllProcessors();
  startedAt = Date.now();
  setWorkerRunning(true);
  shuttingDown = false;

  void restorePersistedJobs().then(() => processQueueTick());

  const pollMs = 150;
  intervalId = setInterval(() => {
    if (shuttingDown) return;
    void processQueueTick().catch((err) => {
      logger.warn('background.worker.tick_failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }, pollMs);

  window.addEventListener('beforeunload', stopBackgroundWorkers);
  window.addEventListener('pagehide', stopBackgroundWorkers);

  logger.info('background.workers.started', { pollMs });
}

export function stopBackgroundWorkers(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  setWorkerRunning(false);
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function isBackgroundWorkersRunning(): boolean {
  return intervalId != null && !shuttingDown;
}

export function getClientBackgroundStatus(): ClientBackgroundStatus {
  const now = Date.now();
  const queues = getAllQueueMetrics().map((q) => ({
    ...q,
    deadLetter: getDeadLetterJobs(q.queue).length,
  }));

  const slowJobs = getPendingJobs()
    .filter((j) => j.startedAt && now - j.startedAt > SLOW_JOB_MS)
    .map((j) => ({
      id: j.id,
      queue: j.queue as QueueKind,
      type: j.type,
      durationMs: now - (j.startedAt ?? now),
    }));

  const recentFailures = getDeadLetterJobs()
    .slice(0, 10)
    .map((j) => ({
      id: j.id,
      queue: j.queue,
      type: j.type,
      error: j.lastError ?? 'unknown',
      at: j.completedAt ?? j.createdAt,
    }));

  return {
    startedAt,
    uptimeMs: startedAt ? now - startedAt : 0,
    queues,
    slowJobs,
    recentFailures,
  };
}

/** @internal test helper */
export function resetSchedulerForTests(): void {
  stopBackgroundWorkers();
  startedAt = 0;
  shuttingDown = false;
}
