import type { StoreMarketingConfig } from '@/services/marketingService';

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

let trackingEnabled = false;
let trackingOwnerId: string | null = null;
let initPromise: Promise<void> | null = null;

function initMetaPixelScript(pixelId: string, ownerId: string): void {
  const needsReinit = window._metaPixelOwnerId && window._metaPixelOwnerId !== ownerId;

  if (window.fbq && window._metaPixelId === pixelId && !needsReinit) return;

  if (needsReinit && window.fbq) {
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    window._metaPixelOwnerId = ownerId;
    window._metaPixelId = pixelId;
    return;
  }

  if (window.fbq) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';

  const fbq = function (...args: unknown[]) {
    const q = fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
    if (q.callMethod) {
      q.callMethod(...args);
    } else {
      q.queue.push(args);
    }
  } as Window['fbq'];

  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  (fbq as unknown as { push: unknown; loaded: boolean; version: string; queue: unknown[] }).push = fbq;
  (fbq as unknown as { loaded: boolean }).loaded = true;
  (fbq as unknown as { version: string }).version = '2.0';
  (fbq as unknown as { queue: unknown[] }).queue = [];

  script.onload = () => {
    window.fbq?.('init', pixelId);
    window.fbq?.('track', 'PageView');
    window._metaPixelOwnerId = ownerId;
    window._metaPixelId = pixelId;
  };

  document.head.appendChild(script);
}

function initGoogleAnalytics(measurementId: string): void {
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

export function isMarketingTrackingEnabled(): boolean {
  return trackingEnabled;
}

export async function initMarketingTracking(config: StoreMarketingConfig): Promise<void> {
  if (!config.marketingEnabled) {
    trackingEnabled = false;
    trackingOwnerId = null;
    return;
  }

  trackingEnabled = true;
  trackingOwnerId = config.ownerId;

  if (config.metaPixelId) {
    initMetaPixelScript(config.metaPixelId, config.ownerId);
  }
  if (config.googleAnalyticsId) {
    initGoogleAnalytics(config.googleAnalyticsId);
  }
}

export async function ensureMarketingTracking(opts: {
  fetchConfig: () => Promise<StoreMarketingConfig | null>;
}): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const config = await opts.fetchConfig();
    if (config) await initMarketingTracking(config);
  })();

  return initPromise;
}

export function resetMarketingTrackingInit(): void {
  initPromise = null;
}

export interface MetaEventPayload {
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
  content_name?: string;
  num_items?: number;
  eventID?: string;
}

export function trackMetaEvent(event: string, data?: MetaEventPayload): void {
  if (!trackingEnabled || !window.fbq) return;
  if (data) window.fbq('track', event, data);
  else window.fbq('track', event);
}

export function trackGoogleEvent(event: string, params?: Record<string, unknown>): void {
  if (!trackingEnabled || !window.gtag) return;
  window.gtag('event', event, params);
}

export function getTrackingOwnerId(): string | null {
  return trackingOwnerId;
}
