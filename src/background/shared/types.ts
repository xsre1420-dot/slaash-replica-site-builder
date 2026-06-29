/** Isolated queue domains — one overloaded queue must not block another. */
export type QueueKind =
  | 'orders'
  | 'inventory'
  | 'notifications'
  | 'analytics'
  | 'import'
  | 'export'
  | 'image'
  | 'webhook'
  | 'cache'
  | 'search';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export type BackgroundJob<TPayload = unknown> = {
  id: string;
  queue: QueueKind;
  type: string;
  payload: TPayload;
  idempotencyKey?: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  scheduledAt: number;
  startedAt?: number;
  completedAt?: number;
  lastError?: string;
};

export type QueueConfig = {
  kind: QueueKind;
  maxConcurrency: number;
  defaultMaxAttempts: number;
  pollIntervalMs: number;
};

export type QueueMetrics = {
  queue: QueueKind;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  avgExecutionMs: number;
  successRate: number;
  retryCount: number;
  oldestPendingMs: number;
  workerActive: boolean;
  lastHeartbeatAt: number | null;
  processingRatePerMin: number;
  queueLatencyMs: number;
};

export type ClientBackgroundStatus = {
  startedAt: number;
  uptimeMs: number;
  queues: QueueMetrics[];
  slowJobs: Array<{ id: string; queue: QueueKind; type: string; durationMs: number }>;
  recentFailures: Array<{ id: string; queue: QueueKind; type: string; error: string; at: number }>;
};
