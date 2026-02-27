import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Web Vitals monitoring
const reportWebVitals = async () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Use PerformanceObserver for Core Web Vitals
    // LCP - Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      console.log(`[Web Vitals] LCP: ${lastEntry.startTime.toFixed(0)}ms`);
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // FID - First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fid = (entry as any).processingStart - entry.startTime;
        console.log(`[Web Vitals] FID: ${fid.toFixed(0)}ms`);
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });

    // CLS - Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      console.log(`[Web Vitals] CLS: ${clsValue.toFixed(3)}`);
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    // Navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (nav) {
          console.log(`[Web Vitals] TTFB: ${nav.responseStart.toFixed(0)}ms`);
          console.log(`[Web Vitals] DOM Load: ${nav.domContentLoadedEventEnd.toFixed(0)}ms`);
          console.log(`[Web Vitals] Full Load: ${nav.loadEventEnd.toFixed(0)}ms`);
        }
      }, 0);
    });
  } catch (e) {
    // PerformanceObserver not supported in all browsers
  }
};

// Register service worker for caching
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Service Worker registered');
    } catch (e) {
      console.log('[SW] Service Worker registration failed:', e);
    }
  }
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Initialize performance monitoring and SW
reportWebVitals();
registerServiceWorker();
