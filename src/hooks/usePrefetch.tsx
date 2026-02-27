import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook for prefetching pages on hover/focus for faster navigation
 */
export const usePrefetch = () => {
  const navigate = useNavigate();
  const prefetchedRoutes = useRef(new Set<string>());

  const prefetch = useCallback((route: string) => {
    if (prefetchedRoutes.current.has(route)) return;
    prefetchedRoutes.current.add(route);

    // Trigger lazy import for the route module
    const routeImports: Record<string, () => Promise<any>> = {
      '/': () => import('@/pages/Index'),
      '/login': () => import('@/pages/Login'),
      '/signup': () => import('@/pages/Signup'),
      '/builder': () => import('@/pages/Builder'),
      '/products': () => import('@/pages/Products'),
      '/orders': () => import('@/pages/Orders'),
      '/settings': () => import('@/pages/Settings'),
      '/statistics': () => import('@/pages/Statistics'),
      '/marketing': () => import('@/pages/Marketing'),
      '/add-product': () => import('@/pages/AddProduct'),
      '/preview': () => import('@/pages/PreviewStore'),
      '/checkout': () => import('@/pages/Checkout'),
      '/inventory': () => import('@/pages/Inventory'),
    };

    const importFn = routeImports[route];
    if (importFn) {
      importFn().catch(() => {
        // Silently fail - prefetch is an optimization, not critical
        prefetchedRoutes.current.delete(route);
      });
    }
  }, []);

  const onHoverPrefetch = useCallback((route: string) => {
    return {
      onMouseEnter: () => prefetch(route),
      onFocus: () => prefetch(route),
    };
  }, [prefetch]);

  return { prefetch, onHoverPrefetch };
};
