import type { MetaEventCustomData, MetaStandardEventName, MetaTrackOptions } from '@/lib/meta/types';
import { recordMetaDiagnostic, updateMetaRuntimeState } from '@/lib/meta/diagnostics';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    _metaPixelOwnerId?: string;
    _metaPixelId?: string;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    _gaMeasurementId?: string;
  }
}

let scriptInjectPromise: Promise<void> | null = null;

function injectFbeventsScript(): Promise<void> {
  if (scriptInjectPromise) return scriptInjectPromise;

  scriptInjectPromise = new Promise((resolve) => {
    if (window.fbq && (window.fbq as unknown as { loaded?: boolean }).loaded) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';

    const fbq = function (...args: unknown[]) {
      const q = fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
      if (q.callMethod) q.callMethod(...args);
      else q.queue.push(args);
    } as Window['fbq'];

    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    const fbqObj = fbq as unknown as { push: unknown; loaded: boolean; version: string; queue: unknown[] };
    fbqObj.push = fbq;
    fbqObj.loaded = true;
    fbqObj.version = '2.0';
    fbqObj.queue = [];

    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
    updateMetaRuntimeState({ scriptInjected: true });
  });

  return scriptInjectPromise;
}

export async function initMetaPixel(pixelId: string, ownerId: string): Promise<void> {
  const trimmed = pixelId.trim();
  if (!trimmed) return;

  await injectFbeventsScript();

  const tenantSwitch = window._metaPixelOwnerId && window._metaPixelOwnerId !== ownerId;
  const samePixel = window._metaPixelId === trimmed;

  if (window.fbq && samePixel && !tenantSwitch) {
    updateMetaRuntimeState({ loaded: true, pixelId: trimmed, ownerId });
    return;
  }

  window.fbq?.('init', trimmed);
  window._metaPixelOwnerId = ownerId;
  window._metaPixelId = trimmed;

  updateMetaRuntimeState({
    loaded: true,
    pixelId: trimmed,
    ownerId,
  });
}

export function trackMetaPixelPageView(path?: string): void {
  if (!window.fbq) return;
  const pathname = path ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  window.fbq('track', 'PageView');
  updateMetaRuntimeState({ lastPageViewPath: pathname });
  recordMetaDiagnostic({
    channel: 'browser',
    eventName: 'PageView',
    eventId: `pageview:${pathname}:${Date.now()}`,
    pixelId: window._metaPixelId,
    success: true,
    deduplicationKey: pathname,
  });
}

export function trackMetaPixelEvent(
  eventName: MetaStandardEventName | string,
  customData?: MetaEventCustomData,
  options?: MetaTrackOptions
): void {
  if (!window.fbq) return;

  const eventId = options?.eventId;
  const data = customData ? { ...customData } : undefined;

  if (eventId) {
    window.fbq('track', eventName, data ?? {}, { eventID: eventId });
  } else if (data) {
    window.fbq('track', eventName, data);
  } else {
    window.fbq('track', eventName);
  }

  recordMetaDiagnostic({
    channel: 'browser',
    eventName,
    eventId: eventId ?? `${eventName}:${Date.now()}`,
    pixelId: window._metaPixelId ?? undefined,
    success: true,
    deduplicationKey: eventId,
    payload: data as Record<string, unknown> | undefined,
    matchQualityHints: eventId ? ['event_id_set'] : ['event_id_missing'],
  });
}

export function initGoogleAnalytics(measurementId: string): void {
  if (window._gaMeasurementId === measurementId && window.gtag) return;

  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag('js', new Date());
  }

  if (!document.querySelector(`script[data-ga-id="${measurementId}"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.gaId = measurementId;
    document.head.appendChild(script);
  }

  window.gtag('config', measurementId, { send_page_view: true });
  window._gaMeasurementId = measurementId;
}

export function trackGoogleEvent(event: string, params?: Record<string, unknown>): void {
  if (!window.gtag) return;
  window.gtag('event', event, params);
}

export function isMetaPixelLoaded(): boolean {
  return Boolean(window.fbq && window._metaPixelId);
}
