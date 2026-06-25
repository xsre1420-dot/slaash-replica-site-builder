import { supabase } from '@/integrations/supabase/client';
import {
  getQueuedOperations,
  removeFromQueue,
  type QueuedOperation,
} from '@/utils/indexedDB';
import { logger } from '@/lib/observability';

let flushing = false;

const replayOperation = async (op: QueuedOperation): Promise<boolean> => {
  const table = op.table?.trim();
  if (!table) return false;

  try {
    if (op.type === 'insert') {
      const { error } = await supabase.from(table as never).insert(op.data);
      if (error) throw error;
      return true;
    }

    if (op.type === 'update') {
      const { id, ...patch } = op.data ?? {};
      if (!id) return false;
      const { error } = await supabase.from(table as never).update(patch).eq('id', id);
      if (error) throw error;
      return true;
    }

    if (op.type === 'delete') {
      const id = op.data?.id;
      if (!id) return false;
      const { error } = await supabase.from(table as never).delete().eq('id', id);
      if (error) throw error;
      return true;
    }
  } catch (err) {
    logger.warn('offlineSync.replay_failed', {
      table,
      type: op.type,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return false;
};

/** Flush IndexedDB offline queue when connectivity returns. */
export async function flushOfflineQueue(): Promise<{ flushed: number; remaining: number }> {
  if (flushing || typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: 0, remaining: 0 };
  }

  flushing = true;
  let flushed = 0;

  try {
    const operations = await getQueuedOperations();
    if (operations.length === 0) return { flushed: 0, remaining: 0 };

    for (const op of operations) {
      const ok = await replayOperation(op);
      if (ok && op.id != null) {
        await removeFromQueue(op.id);
        flushed++;
      }
    }

    const remaining = (await getQueuedOperations()).length;
    if (flushed > 0) {
      logger.info('offlineSync.flushed', { flushed, remaining });
    }
    return { flushed, remaining };
  } finally {
    flushing = false;
  }
}

export function registerOfflineSyncListeners(onFlushed?: (result: { flushed: number; remaining: number }) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onOnline = () => {
    void flushOfflineQueue().then((result) => {
      if (result.flushed > 0 || result.remaining > 0) {
        onFlushed?.(result);
      }
    });
  };

  window.addEventListener('online', onOnline);
  if (navigator.onLine) {
    void flushOfflineQueue();
  }

  return () => window.removeEventListener('online', onOnline);
}
