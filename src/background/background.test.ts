import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resetQueuesForTests } from '@/background/queues/JobQueue';
import { clearDeadLetterForTests } from '@/background/retry/deadLetterQueue';
import { clearIdempotencyRegistryForTests } from '@/background/shared/idempotency';
import { registerProcessor } from '@/background/processors/registry';
import { computeBackoffMs } from '@/background/retry/backoff';

vi.mock('@/lib/observability', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('background JobQueue', () => {
  beforeEach(() => {
    resetQueuesForTests();
    clearDeadLetterForTests();
    clearIdempotencyRegistryForTests();
  });

  it('processes jobs asynchronously with retry on failure', async () => {
    const { enqueueJob, processQueueTick, getPendingJobs } = await import('@/background/queues/JobQueue');
    let attempts = 0;
    registerProcessor('test.flaky', async () => {
      attempts += 1;
      if (attempts < 2) throw new Error('transient');
    });

    enqueueJob('cache', 'test.flaky', {}, { maxAttempts: 3 });
    expect(getPendingJobs()).toHaveLength(1);

    await processQueueTick();
    expect(attempts).toBe(1);
    expect(getPendingJobs()[0]?.attempts).toBe(1);

    const job = getPendingJobs()[0];
    if (job) job.scheduledAt = Date.now() - 1;

    await processQueueTick();
    expect(attempts).toBe(2);
    expect(getPendingJobs()).toHaveLength(0);
  });

  it('deduplicates by idempotency key', async () => {
    const { enqueueJob, getPendingJobs } = await import('@/background/queues/JobQueue');
    registerProcessor('test.noop', async () => {});

    enqueueJob('orders', 'test.noop', {}, { idempotencyKey: 'order:123' });
    enqueueJob('orders', 'test.noop', {}, { idempotencyKey: 'order:123' });

    expect(getPendingJobs()).toHaveLength(1);
  });

  it('moves to dead letter after max attempts', async () => {
    const { enqueueJob, processQueueTick } = await import('@/background/queues/JobQueue');
    const { getDeadLetterJobs } = await import('@/background/retry/deadLetterQueue');

    registerProcessor('test.alwaysFail', async () => {
      throw new Error('permanent');
    });

    enqueueJob('webhook', 'test.alwaysFail', {}, { maxAttempts: 2 });

    await processQueueTick();
    const { getPendingJobs } = await import('@/background/queues/JobQueue');
    const pending = getPendingJobs()[0];
    if (pending) pending.scheduledAt = Date.now() - 1;
    await processQueueTick();

    expect(getDeadLetterJobs('webhook')).toHaveLength(1);
  });
});

describe('backoff', () => {
  it('grows exponentially capped at max', () => {
    expect(computeBackoffMs(1)).toBeGreaterThanOrEqual(400);
    expect(computeBackoffMs(5)).toBeLessThanOrEqual(60_000);
    expect(computeBackoffMs(10)).toBeLessThanOrEqual(60_000);
  });
});
