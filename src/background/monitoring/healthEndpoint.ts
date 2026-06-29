/**
 * Client-side background job monitoring — complements server outbox status.
 */
import { getClientBackgroundStatus } from '@/background/scheduler/JobScheduler';
import { getAllQueueMetrics, getPendingJobs } from '@/background/queues/JobQueue';
import { getDeadLetterJobs } from '@/background/retry/deadLetterQueue';
import { fetchUnifiedBackgroundStatus } from '@/services/backgroundJobsService';

export type BackgroundMonitoringSnapshot = {
  client: ReturnType<typeof getClientBackgroundStatus>;
  pendingJobCount: number;
  deadLetterCount: number;
  server: Awaited<ReturnType<typeof fetchUnifiedBackgroundStatus>>;
};

/** Full monitoring snapshot — client queues + server outboxes. */
export async function fetchBackgroundMonitoringSnapshot(): Promise<BackgroundMonitoringSnapshot> {
  const server = await fetchUnifiedBackgroundStatus();
  return {
    client: getClientBackgroundStatus(),
    pendingJobCount: getPendingJobs().length,
    deadLetterCount: getDeadLetterJobs().length,
    server,
  };
}

export { getClientBackgroundStatus, getAllQueueMetrics, getDeadLetterJobs };
