import React from 'react';
import { createRoot } from 'react-dom/client';
import { env, isObservabilityClientEnabled } from '@/lib/env';
import { initMonitoring } from '@/lib/monitoring';
import { registerGlobalErrorHandlers } from '@/lib/observability';
import { registerOfflineSyncListeners } from '@/services/offlineSyncService';
import { installGracefulLifecycle } from '@/core/horizontalScaling/probes';
import { startBackgroundWorkers } from '@/background';
import { installMemoryLifecycle } from '@/lib/memory/lifecycle';
import App from './App.tsx';
import './index.css';
import './styles/subscription.css';

initMonitoring({
  webhookUrl: isObservabilityClientEnabled() ? env.VITE_OBSERVABILITY_WEBHOOK_URL : undefined,
  sampleRate: env.VITE_OBSERVABILITY_SAMPLE_RATE,
});

registerGlobalErrorHandlers();
installMemoryLifecycle();
installGracefulLifecycle(startBackgroundWorkers);
registerOfflineSyncListeners((result) => {
  window.dispatchEvent(new CustomEvent('offline-queue-flushed', { detail: result }));
});

// Register service worker for caching (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
