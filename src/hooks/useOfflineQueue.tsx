
/**
 * Suggestion #12: Offline operation queue
 * When connection is lost, queue operations and execute when back online
 */

import { useEffect, useRef, useCallback } from 'react';
import { getQueuedOperations, removeFromQueue, addToQueue, QueuedOperation } from '@/utils/indexedDB';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useOfflineQueue = () => {
  const processingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const operations = await getQueuedOperations();
      if (operations.length === 0) {
        processingRef.current = false;
        return;
      }

      console.log(`[OfflineQueue] Processing ${operations.length} queued operations`);
      let successCount = 0;

      for (const op of operations) {
        try {
          let error: any;
          
          if (op.type === 'insert') {
            const result = await supabase.from(op.table as any).insert(op.data);
            error = result.error;
          } else if (op.type === 'update') {
            const { id, ...updateData } = op.data;
            const result = await supabase.from(op.table as any).update(updateData).eq('id', id);
            error = result.error;
          } else if (op.type === 'delete') {
            const result = await supabase.from(op.table as any).delete().eq('id', op.data.id);
            error = result.error;
          }

          if (!error && op.id) {
            await removeFromQueue(op.id);
            successCount++;
          }
        } catch (e) {
          console.warn('[OfflineQueue] Failed to process operation:', e);
        }
      }

      if (successCount > 0) {
        toast.success(`تمت مزامنة ${successCount} عملية معلقة`);
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
