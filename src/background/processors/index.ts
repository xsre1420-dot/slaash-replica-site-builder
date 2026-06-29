import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/observability';
import { invalidateStorefrontScope, invalidateStorefrontForOwner } from '@/services/write/storefront/storefrontCacheWriteService';
import { requestEdgeStorefrontPurge } from '@/services/storefrontEdgeService';
import {
  cleanupRemovedProductImages,
  deleteProductStorageImages,
} from '@/utils/productImageCleanup';
import { trackStoreVisitBySlug, trackProductViewBySlug } from '@/services/analyticsTrackingService';
import { processProductImportBatch } from '@/services/importJobService';
import { enqueueJob } from '@/background/queues/JobQueue';
import { registerProcessor } from '@/background/processors/registry';
import type { BackgroundJob } from '@/background/shared/types';
import type { StorefrontInvalidationScope } from '@/services/storefrontCacheTiers';

export function registerAllProcessors(): void {
  registerProcessor('cache.invalidateScope', async (job: BackgroundJob) => {
    const p = job.payload as {
      ownerId: string;
      scope: StorefrontInvalidationScope;
      productId?: string;
      bumpVersion?: boolean;
    };
    await invalidateStorefrontScope(p.ownerId, p.scope, {
      productId: p.productId,
      bumpVersion: p.bumpVersion,
    });
  });

  registerProcessor('cache.invalidateForOwner', async (job: BackgroundJob) => {
    const p = job.payload as { ownerId: string; bumpVersion?: boolean };
    await invalidateStorefrontForOwner(p.ownerId, { bumpVersion: p.bumpVersion });
  });

  registerProcessor('cache.edgePurge', async (job: BackgroundJob) => {
    const p = job.payload as { slug: string };
    await requestEdgeStorefrontPurge(p.slug);
  });

  registerProcessor('orders.metaConversions', async (job: BackgroundJob) => {
    const p = job.payload as {
      storeSlug: string;
      orderId: string;
      value: number;
      currency: string;
      contentIds: string[];
      customerPhone: string | null;
      eventSourceUrl: string | null;
    };
    const { error } = await (supabase as any).functions.invoke('meta-conversions', {
      body: {
        store_slug: p.storeSlug,
        order_id: p.orderId,
        value: p.value,
        currency: p.currency,
        content_ids: p.contentIds,
        customer_phone: p.customerPhone,
        event_source_url: p.eventSourceUrl,
      },
    });
    if (error) throw new Error(error.message ?? 'meta-conversions failed');
  });

  registerProcessor('image.cleanupRemoved', async (job: BackgroundJob) => {
    const p = job.payload as { before: Record<string, unknown>; after: Record<string, unknown> };
    await cleanupRemovedProductImages(p.before, p.after);
  });

  registerProcessor('image.deleteStorage', async (job: BackgroundJob) => {
    const p = job.payload as { urls: string[] };
    await deleteProductStorageImages(p.urls);
  });

  registerProcessor('analytics.trackVisit', async (job: BackgroundJob) => {
    const p = job.payload as { storeSlug: string; pagePath: string; userAgent: string | null };
    await trackStoreVisitBySlug(p.storeSlug, p.pagePath, p.userAgent);
  });

  registerProcessor('analytics.trackProductView', async (job: BackgroundJob) => {
    const p = job.payload as { slug: string; productId: string; pagePath: string | null };
    await trackProductViewBySlug(p.slug, p.productId, p.pagePath);
  });

  registerProcessor('image.cleanupBranding', async (job: BackgroundJob) => {
    const { cleanupRemovedBrandingImages } = await import('@/utils/productImageCleanup');
    const p = job.payload as {
      before: { storeLogo?: string | null };
      after: { storeLogo?: string | null };
    };
    await cleanupRemovedBrandingImages(p.before, p.after);
  });

  registerProcessor('import.processBatch', async (job: BackgroundJob) => {
    const p = job.payload as { jobId: string; batchSize?: number };
    const result = await processProductImportBatch(p.jobId, p.batchSize ?? 25);
    if (!result.success) throw new Error(result.error ?? 'import batch failed');
    if (
      !result.done &&
      result.status !== 'completed' &&
      result.status !== 'failed'
    ) {
      enqueueJob(
        'import',
        'import.processBatch',
        { jobId: p.jobId, batchSize: p.batchSize ?? 25 },
        { idempotencyKey: `import:${p.jobId}:${result.processedRows ?? 0}` }
      );
    }
  });

  logger.info('background.processors.registered', {
    count: 10,
  });
}
