
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

/**
 * Predictive route preloading after login.
 * Data bootstrap is handled globally by StoreBootstrap / useStoreBootstrap.
 */
export const usePreloadData = () => {
  const { user } = useAuth();
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (!user?.id || hasPreloaded.current) return;
    hasPreloaded.current = true;

    const preloadChunks = () => {
      import('@/pages/Orders').catch(() => {});
      import('@/pages/Products').catch(() => {});
      import('@/pages/Statistics').catch(() => {});
      import('@/pages/AddProduct').catch(() => {});
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadChunks, { timeout: 1_500 });
      return () => window.cancelIdleCallback(idleId);
    }

    timer = setTimeout(preloadChunks, 800);

    return () => clearTimeout(timer);
  }, [user?.id]);
};
