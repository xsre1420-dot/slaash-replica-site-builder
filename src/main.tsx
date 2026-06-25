import React from 'react';
import { createRoot } from 'react-dom/client';
import { env, isObservabilityClientEnabled } from '@/lib/env';
import { initObservability, registerGlobalErrorHandlers } from '@/lib/observability';
import App from './App.tsx';
import './index.css';

initObservability({
  webhookUrl: isObservabilityClientEnabled() ? env.VITE_OBSERVABILITY_WEBHOOK_URL : undefined,
  sampleRate: env.VITE_OBSERVABILITY_SAMPLE_RATE,
});

registerGlobalErrorHandlers();

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
