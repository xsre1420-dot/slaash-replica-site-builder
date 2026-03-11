
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { loadProducts, getCategories } from '@/data/dummyData';

export const usePreloadData = () => {
  const { user } = useAuth();
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (!user?.id || hasPreloaded.current) return;
    hasPreloaded.current = true;

    // Preload products and categories in parallel
    Promise.all([
      loadProducts(true),
      getCategories(true),
    ]).catch(() => {});

    // Predictive route preloading after a delay
    const timer = setTimeout(() => {
      import('@/pages/AddProduct').catch(() => {});
      import('@/pages/Orders').catch(() => {});
    }, 3000);

    return () => clearTimeout(timer);
  }, [user?.id]);
};
