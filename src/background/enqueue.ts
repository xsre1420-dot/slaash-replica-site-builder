/**
 * Public enqueue API — replaces raw fire-and-forget void calls.
 * Business handlers unchanged; execution deferred to background workers.
 */
import { enqueueJob } from '@/background/queues/JobQueue';
import type { QueueKind } from '@/background/shared/types';
import type { StorefrontInvalidationScope } from '@/services/storefrontCacheTiers';
import { safeEnqueueBestEffort } from '@/core/distributed/failureIsolation';

export { enqueueJob };

export function enqueueCacheInvalidation(
  ownerId: string,
  scope: StorefrontInvalidationScope,
  options?: { productId?: string; bumpVersion?: boolean }
): string {
  return enqueueJob(
    'cache',
    'cache.invalidateScope',
    { ownerId, scope, productId: options?.productId, bumpVersion: options?.bumpVersion },
    {
      idempotencyKey: `cache:${ownerId}:${scope}:${options?.productId ?? 'all'}:${options?.bumpVersion ?? false}`,
    }
  );
}

export function enqueueCacheInvalidationForOwner(
  ownerId: string,
  options?: { bumpVersion?: boolean }
): string {
  return enqueueJob(
    'cache',
    'cache.invalidateForOwner',
    { ownerId, bumpVersion: options?.bumpVersion },
    { idempotencyKey: `cache:full:${ownerId}:${options?.bumpVersion ?? false}` }
  );
}

export function enqueueEdgePurge(slug: string): string {
  return enqueueJob('cache', 'cache.edgePurge', { slug }, {
    idempotencyKey: `edge-purge:${slug}`,
  });
}

export function enqueueMetaConversion(payload: {
  storeSlug: string;
  orderId: string;
  eventId: string;
  value: number;
  currency: string;
  contentIds: string[];
  contents: Array<{ id: string; quantity: number }>;
  numItems: number;
  customerPhone: string | null;
  customerName?: string | null;
  customerGovernorate?: string | null;
  customerEmail?: string | null;
  externalId?: string | null;
  eventSourceUrl: string | null;
  fbp: string | null;
  fbc: string | null;
}): string {
  return enqueueJob('orders', 'orders.metaConversions', payload, {
    idempotencyKey: `meta:${payload.orderId}`,
    maxAttempts: 4,
  });
}

export function enqueueImageCleanup(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string {
  return safeEnqueueBestEffort('media', () =>
    enqueueJob('image', 'image.cleanupRemoved', { before, after })
  );
}

export function enqueueImageDelete(urls: string[]): string {
  if (urls.length === 0) return '';
  return safeEnqueueBestEffort('media', () => enqueueJob('image', 'image.deleteStorage', { urls }));
}

export function enqueueBrandingCleanup(
  before: { storeLogo?: string | null },
  after: { storeLogo?: string | null }
): string {
  return safeEnqueueBestEffort('media', () =>
    enqueueJob('image', 'image.cleanupBranding', { before, after })
  );
}

export function enqueueAnalyticsVisit(
  storeSlug: string,
  pagePath: string,
  userAgent: string | null
): string {
  const normalized = storeSlug.trim().toLowerCase();
  return safeEnqueueBestEffort('analytics', () =>
    enqueueJob(
      'analytics',
      'analytics.trackVisit',
      { storeSlug: normalized, pagePath, userAgent },
      {
        idempotencyKey: `visit:${normalized}`,
        maxAttempts: 1,
      }
    )
  );
}

export function enqueueAnalyticsProductView(
  slug: string,
  productId: string,
  pagePath: string | null
): string {
  const normalized = slug.trim().toLowerCase();
  return safeEnqueueBestEffort('analytics', () =>
    enqueueJob(
      'analytics',
      'analytics.trackProductView',
      { slug: normalized, productId, pagePath },
      {
        idempotencyKey: `view:${normalized}:${productId}`,
        maxAttempts: 1,
      }
    )
  );
}

export function enqueueImportBatchJob(jobId: string, batchSize = 25): string {
  return safeEnqueueBestEffort('imports', () =>
    enqueueJob(
      'import',
      'import.processBatch',
      { jobId, batchSize },
      { idempotencyKey: `import:start:${jobId}` }
    )
  );
}

export function enqueueBackgroundJob<T>(
  queue: QueueKind,
  type: string,
  payload: T,
  options?: { idempotencyKey?: string; maxAttempts?: number; delayMs?: number }
): string {
  return enqueueJob(queue, type, payload, options);
}
