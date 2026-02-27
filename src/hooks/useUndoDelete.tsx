
/**
 * Suggestion #18: Undo delete with timed toast
 */

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface UndoDeleteOptions<T> {
  item: T;
  itemName: string;
  onDelete: () => Promise<{ success: boolean; error?: string }>;
  onRestore?: (item: T) => void;
  timeoutMs?: number;
}

export const useUndoDelete = () => {
  const pendingDeleteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deleteWithUndo = useCallback(<T,>(options: UndoDeleteOptions<T>) => {
    const { item, itemName, onDelete, onRestore, timeoutMs = 5000 } = options;
    
    let cancelled = false;

    // Show toast with undo button
    toast(`تم حذف "${itemName}"`, {
      duration: timeoutMs,
      action: {
        label: 'تراجع',
        onClick: () => {
          cancelled = true;
          if (pendingDeleteRef.current) {
            clearTimeout(pendingDeleteRef.current);
            pendingDeleteRef.current = null;
          }
          onRestore?.(item);
          toast.success(`تم استعادة "${itemName}"`);
        },
      },
    });

    // Schedule actual deletion
    pendingDeleteRef.current = setTimeout(async () => {
      if (cancelled) return;
      
      const result = await onDelete();
      if (!result.success) {
        toast.error(`فشل حذف "${itemName}": ${result.error || 'خطأ غير معروف'}`);
        onRestore?.(item);
      }
    }, timeoutMs);
  }, []);

  return { deleteWithUndo };
};
