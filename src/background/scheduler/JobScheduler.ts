import {
  processQueueTick,
  setWorkerRunning,
  getAllQueueMetrics,
  getPendingJobs,
  hasBackgroundQueueWork,
  restoreJobs,
} from '@/background/queues/JobQueue';
import { getDeadLetterJobs } from '@/background/retry/deadLetterQueue';
import { registerAllProcessors } from '@/background/processors';
import { restorePendingJobs } from '@/background/shared/jobPersistence';
import type { ClientBackgroundStatus, QueueKind } from '@/background/shared/types';
import { getWorkerInstanceId } from '@/core/distributed/workerIdentity';
import { resolveWorkerPollIntervalMs } from '@/lib/costOptimization/computeEfficiency';
import { shouldSuspendWorkerPolling } from '@/lib/finOpsScaling/operationalEfficiency';
import { registerWorkerResumeHook } from '@/background/queues/JobQueue';
import { logger } from '@/lib/observability';

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let startedAt = 0;
let shuttingDown = false;
let suspended = false;
let visibilityHookInstalled = false;

const SLOW_JOB_MS = 3000;

async function restorePersistedJobs(): Promise<void> {
  const jobs = await restorePendingJobs();
  if (jobs.length > 0) {
    restoreJobs(jobs);
    logger.info('background.jobs.restored', { count: jobs.length });
  }
}

function installVisibilityResumeHook(): void {
  if (visibilityHookInstalled || typeof document === 'undefined') return;
  visibilityHookInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && suspended && !shuttingDown) {
      resumeBackgroundWorkersIfSuspended();
    }
  });
}

function scheduleNextTick(): void {
  if (shuttingDown) return;

  const hasWork = hasBackgroundQueueWork();
  if (shouldSuspendWorkerPolling(hasWork)) {
    suspended = true;
    setWorkerRunning(false);
    installVisibilityResumeHook();
    return;
  }

  suspended = false;
  setWorkerRunning(true);
  const delayMs = resolveWorkerPollIntervalMs(hasWork);
  pollTimer = setTimeout(async () => {
    pollTimer = null;
    if (shuttingDown) return;
    try {
      await processQueueTick();
    } catch (err) {
      logger.warn('background.worker.tick_failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    scheduleNextTick();
  }, delayMs);
}

/** Resume scheduler after suspend (visibility change or new job enqueued). */
export function resumeBackgroundWorkersIfSuspended(): void {
  if (shuttingDown || !suspended) return;
  suspended = false;
  setWorkerRunning(true);
  void processQueueTick().finally(() => scheduleNextTick());
}

export function startBackgroundWorkers(): void {
  if (typeof window === 'undefined') return;
  if (pollTimer != null || (suspended && !shuttingDown)) return;

  registerAllProcessors();
  registerWorkerResumeHook(resumeBackgroundWorkersIfSuspended);
  startedAt = Date.now();
  setWorkerRunning(true);
  shuttingDown = false;
  suspended = false;

  void restorePersistedJobs().then(() => processQueueTick().finally(() => scheduleNextTick()));

  logger.info('background.workers.started', { mode: 'adaptive_poll_suspend' });
}

export function stopBackgroundWorkers(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  suspended = false;
  setWorkerRunning(false);
  if (pollTimer != null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

export function isBackgroundWorkersRunning(): boolean {
  return (pollTimer != null || suspended) && !shuttingDown;
}

export function isBackgroundWorkersSuspended(): boolean {
  return suspended && !shuttingDown;
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
    workerInstanceId: getWorkerInstanceId(),
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
  suspended = false;
}
