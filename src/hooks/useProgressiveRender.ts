import { useEffect, useState, useCallback } from 'react';

/** Progressive render — shows items in batches as user scrolls (lightweight virtualization). */
export function useProgressiveRender<T>(items: T[], batchSize = 48) {
  const [visibleCount, setVisibleCount] = useState(batchSize);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [items, batchSize]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + batchSize, items.length));
  }, [batchSize, items.length]);

  return { visibleItems, hasMore, loadMore, total: items.length };
}
