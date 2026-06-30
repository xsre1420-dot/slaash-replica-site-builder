import type { ObservabilityEvent } from './types';

const FLUSH_INTERVAL_MS = 30_000;
const MAX_BUFFER = 100;

let webhookUrl = '';
let sampleRate = 1;
let buffer: ObservabilityEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

export const configureReporter = (options: { webhookUrl?: string; sampleRate?: number }) => {
  webhookUrl = options.webhookUrl?.trim() || '';
  sampleRate = Math.min(1, Math.max(0, options.sampleRate ?? 1));
};

const shouldSample = (): boolean => Math.random() <= sampleRate;

export const enqueueEvent = (event: ObservabilityEvent) => {
  if (!shouldSample()) return;

  buffer.push(event);
  if (buffer.length > MAX_BUFFER) {
    buffer = buffer.slice(-MAX_BUFFER);
  }

  if (
    event.type === 'alert' ||
    (event.type === 'log' && (event.level === 'error' || event.level === 'fatal'))
  ) {
    flushEvents(true);
  }
};

export const flushEvents = (urgent = false) => {
  if (buffer.length === 0) return;

  const batch = buffer.splice(0, buffer.length);
  const payload = JSON.stringify({ events: batch, sentAt: new Date().toISOString() });

  if (webhookUrl) {
    try {
      if (urgent && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(webhookUrl, blob);
        return;
      }

      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        /* swallow network errors to avoid loops */
      });
      return;
    } catch {
      /* fall through to dev console */
    }
  }

  if (import.meta.env.DEV) {
    console.debug('[observability:batch]', batch);
  }
};

export const startReporter = () => {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    flushEvents(false);
  }, FLUSH_INTERVAL_MS);

  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushEvents(true);
    });
    window.addEventListener('pagehide', () => flushEvents(true));
  }
};

export const stopReporter = () => {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
};
