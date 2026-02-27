
/**
 * Suggestion #6: Preload critical data after login
 * Suggestion #15: Predictive loading
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { loadProducts, getCategories } from '@/data/dummyData';
import { cacheSet, cacheGet } from '@/utils/indexedDB';

const CACHE_KEY_PRODUCTS = 'preloaded_products';
const CACHE_KEY_CATEGORIES = 'preloaded_categories';
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

export const usePreloadData = () => {
  const { user } = useAuth();
  const hasPreloaded = useRef(false);

  useEffect(() => {
    if (!user?.id || hasPreloaded.current) return;
    hasPreloaded.current = true;

    const preload = async () => {
      try {
        // Try loading from IndexedDB first for instant display
        const [cachedProducts, cachedCategories] = await Promise.all([
          cacheGet(CACHE_KEY_PRODUCTS, CACHE_MAX_AGE),
          cacheGet(CACHE_KEY_CATEGORIES, CACHE_MAX_AGE),
        ]);

        // Then fetch fresh data in background
        const [products, categories] = await Promise.all([
          loadProducts(true),
          getCategories(true),
        ]);

        // Update IndexedDB cache
        await Promise.all([
          cacheSet(CACHE_KEY_PRODUCTS, products),
          cacheSet(CACHE_KEY_CATEGORIES, categories),
        ]);

        console.log(`[Preload] Loaded ${products.length} products, ${categories.length} categories`);
      } catch (e) {
        console.warn('[Preload] Failed:', e);
      }
    };

    // Start preloading immediately after login
    preload();

    // Suggestion #15: Predictive loading - preload likely next pages
    const preloadRoutes = () => {
      // Preload add-product page since it's the most common next action
      import('@/pages/AddProduct').catch(() => {});
      import('@/pages/Orders').catch(() => {});
    };

    // Delay predictive loading to not compete with critical data
    const timer = setTimeout(preloadRoutes, 3000);
    return () => clearTimeout(timer);
  }, [user?.id]);
};
