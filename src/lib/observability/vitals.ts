import { metrics } from './metrics';
import { logger } from './logger';

export const initWebVitals = () => {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) metrics.timing('web_vitals.lcp', last.startTime);
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* unsupported */
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      let cls = 0;
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
        if (!e.hadRecentInput) cls += e.value || 0;
      }
      if (cls > 0) metrics.timing('web_vitals.cls', cls * 1000);
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* unsupported */
  }

  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      metrics.timing('web_vitals.ttfb', nav.responseStart);
      metrics.timing('web_vitals.dom_content_loaded', nav.domContentLoadedEventEnd);
      metrics.timing('web_vitals.load', nav.loadEventEnd);
    }
  } catch {
    /* ignore */
  }

  logger.debug('Web vitals observers initialized');
};
