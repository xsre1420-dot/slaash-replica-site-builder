import { callSupabaseEdgeFunction } from '@/integrations/supabase/edge';
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
import { recordMetaDiagnostic } from '@/lib/meta/diagnostics';
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
    };
    const { data, error } = await callSupabaseEdgeFunction('meta-conversions', {
      store_slug: p.storeSlug,
      order_id: p.orderId,
      event_id: p.eventId,
      value: p.value,
      currency: p.currency,
      content_ids: p.contentIds,
      contents: p.contents,
      num_items: p.numItems,
      customer_phone: p.customerPhone,
      customer_name: p.customerName ?? null,
      customer_governorate: p.customerGovernorate ?? null,
      customer_email: p.customerEmail ?? null,
      external_id: p.externalId ?? p.orderId,
      event_source_url: p.eventSourceUrl,
      fbp: p.fbp,
      fbc: p.fbc,
    });

    recordMetaDiagnostic({
      channel: 'server',
      eventName: 'Purchase',
      eventId: p.eventId,
      success: !error,
      deduplicationKey: p.eventId,
      error: error ?? undefined,
      retryCount: job.attempts,
      metaResponse: data,
      matchQualityHints: (data as { match_quality?: string[] })?.match_quality,
    });

    if (error) throw new Error(error);
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
    try {
      await trackStoreVisitBySlug(p.storeSlug, p.pagePath, p.userAgent);
    } catch (err) {
      logger.warn('analytics.visit.isolated_failure', {
        storeSlug: p.storeSlug,
        pagePath: p.pagePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  registerProcessor('analytics.trackProductView', async (job: BackgroundJob) => {
    const p = job.payload as { slug: string; productId: string; pagePath: string | null };
    try {
      await trackProductViewBySlug(p.slug, p.productId, p.pagePath);
    } catch (err) {
      logger.warn('analytics.product_view.isolated_failure', {
        slug: p.slug,
        productId: p.productId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
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
