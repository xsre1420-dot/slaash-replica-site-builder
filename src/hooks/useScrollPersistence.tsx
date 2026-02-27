
/**
 * Suggestion #17: Save and restore scroll position + filters
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const scrollPositions = new Map<string, number>();

export const useScrollPersistence = (key?: string) => {
  const location = useLocation();
  const routeKey = key || location.pathname;
  const containerRef = useRef<HTMLDivElement>(null);

  // Save scroll position before leaving
  useEffect(() => {
    const saveScroll = () => {
      scrollPositions.set(routeKey, window.scrollY);
    };

    window.addEventListener('beforeunload', saveScroll);
    
    return () => {
      saveScroll();
      window.removeEventListener('beforeunload', saveScroll);
    };
  }, [routeKey]);

  // Restore scroll position when returning
  useEffect(() => {
    const savedPosition = scrollPositions.get(routeKey);
    if (savedPosition !== undefined) {
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPosition);
      });
    }
  }, [routeKey]);

  return containerRef;
};

// Filter persistence
export const saveFilters = (page: string, filters: Record<string, string>) => {
  try {
    sessionStorage.setItem(`filters_${page}`, JSON.stringify(filters));
  } catch {}
};

export const loadFilters = (page: string): Record<string, string> | null => {
  try {
    const saved = sessionStorage.getItem(`filters_${page}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};
