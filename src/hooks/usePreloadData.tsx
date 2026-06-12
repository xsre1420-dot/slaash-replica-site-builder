
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

    const timer = setTimeout(() => {
      import('@/pages/AddProduct').catch(() => {});
      import('@/pages/Orders').catch(() => {});
      import('@/pages/Products').catch(() => {});
    }, 2000);

    return () => clearTimeout(timer);
  }, [user?.id]);
};
