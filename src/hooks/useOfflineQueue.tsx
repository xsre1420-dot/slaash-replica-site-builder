
/**
 * Suggestion #12: Offline operation queue
 * When connection is lost, queue operations and execute when back online
 */

import { useEffect, useRef, useCallback } from 'react';
import { getQueuedOperations, removeFromQueue, addToQueue, QueuedOperation } from '@/utils/indexedDB';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ALLOWED_OFFLINE_TABLES = new Set([
  'products',
  'categories',
  'marketing_coupons',
  'store_settings',
  'product_reviews',
  'suggested_products',
]);

export const useOfflineQueue = () => {
  const processingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        processingRef.current = false;
        return;
      }

      const operations = await getQueuedOperations();
      if (operations.length === 0) {
        processingRef.current = false;
        return;
      }

      console.log(`[OfflineQueue] Processing ${operations.length} queued operations`);
      let successCount = 0;
      let skippedCount = 0;

      for (const op of operations) {
        if (!ALLOWED_OFFLINE_TABLES.has(op.table)) {
          console.warn(`[OfflineQueue] Skipping unsupported table: ${op.table}`);
          skippedCount++;
          continue;
        }

        try {
          let error: any;
          const payloadOwnerId = op.data?.owner_id;

          if (payloadOwnerId !== user.id) {
            console.warn('[OfflineQueue] Skipping operation with mismatched owner_id', op);
            skippedCount++;
            continue;
          }

          if (op.type === 'insert') {
            if (!op.data?.owner_id) {
              console.warn('[OfflineQueue] Skipping insert without owner_id', op);
              skippedCount++;
              continue;
            }
            const result = await supabase.from(op.table as any).insert(op.data);
            error = result.error;
          } else if (op.type === 'update') {
            const { id, owner_id, ...updateData } = op.data;
            if (!id || !owner_id) {
              console.warn('[OfflineQueue] Skipping update without id or owner_id', op);
              skippedCount++;
              continue;
            }
            const result = await supabase
              .from(op.table as any)
              .update(updateData)
              .eq('id', id)
              .eq('owner_id', owner_id);
            error = result.error;
          } else if (op.type === 'delete') {
            const { id, owner_id } = op.data;
            if (!id || !owner_id) {
              console.warn('[OfflineQueue] Skipping delete without id or owner_id', op);
              skippedCount++;
              continue;
            }
            const result = await supabase
              .from(op.table as any)
              .delete()
              .eq('id', id)
              .eq('owner_id', owner_id);
            error = result.error;
          }

          if (!error && op.id) {
            await removeFromQueue(op.id);
            successCount++;
          } else if (error) {
            console.error('[OfflineQueue] Operation failed:', op.table, error.message);
          }
        } catch (e) {
          console.warn('[OfflineQueue] Failed to process operation:', e);
        }
      }

      if (successCount > 0) {
        toast.success(`تمت مزامنة ${successCount} عملية معلقة`);
      }
      if (skippedCount > 0) {
        toast.warning(`${skippedCount} عملية لم تُزامَن — بيانات غير مكتملة`);
      }
    } finally {
      processingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Process queue when coming back online
    const handleOnline = () => {
      console.log('[OfflineQueue] Back online, processing queue...');
      processQueue();
    };

    window.addEventListener('online', handleOnline);
    
    // Also try processing on mount
    if (navigator.onLine) {
      processQueue();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [processQueue]);

  const queueOperation = useCallback(async (op: Omit<QueuedOperation, 'id' | 'timestamp'>) => {
    await addToQueue(op);
    toast.info('تم حفظ العملية وستُنفذ عند عودة الاتصال');
  }, []);

  return { queueOperation, processQueue };
};
