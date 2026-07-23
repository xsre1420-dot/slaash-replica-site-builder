import type { StoreMarketingConfig } from '@/services/marketingService';
import {
  initMetaPixel,
  initGoogleAnalytics,
  trackMetaPixelEvent,
  trackMetaPixelPageView,
  trackGoogleEvent,
  isMetaPixelLoaded,
} from '@/lib/meta/pixelClient';
import { updateMetaRuntimeState } from '@/lib/meta/diagnostics';
import type { MetaEventCustomData, MetaStandardEventName, MetaTrackOptions } from '@/lib/meta/types';

let trackingEnabled = false;
let trackingOwnerId: string | null = null;
let browserEventsEnabled = true;
let initPromise: Promise<void> | null = null;

export type { MetaEventCustomData, MetaTrackOptions };

/** @deprecated Use MetaEventCustomData — kept for backward compatibility */
export interface MetaEventPayload extends MetaEventCustomData {
  eventID?: string;
}

export function isMarketingTrackingEnabled(): boolean {
  return trackingEnabled;
}

export async function initMarketingTracking(config: StoreMarketingConfig): Promise<void> {
  trackingEnabled = config.marketingEnabled;
  trackingOwnerId = config.ownerId;
  browserEventsEnabled = config.metaBrowserEventsEnabled !== false;

  updateMetaRuntimeState({
    marketingEnabled: config.marketingEnabled,
    browserEventsEnabled,
    debugMode: config.metaDebugMode === true,
    ownerId: config.ownerId,
  });

  if (!config.marketingEnabled) {
    return;
  }

  if (config.metaPixelId && browserEventsEnabled) {
    await initMetaPixel(config.metaPixelId, config.ownerId);
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

export function disableMarketingTracking(): void {
  trackingEnabled = false;
  trackingOwnerId = null;
  browserEventsEnabled = true;
  initPromise = null;
  updateMetaRuntimeState({
    marketingEnabled: false,
    loaded: false,
    pixelId: null,
    ownerId: null,
  });
}

export function trackMetaEvent(
  event: MetaStandardEventName | string,
  data?: MetaEventCustomData,
  options?: MetaTrackOptions
): void {
  if (!trackingEnabled || !browserEventsEnabled) return;
  trackMetaPixelEvent(event, data, options);
}

export function trackMetaPageView(path?: string): void {
  if (!trackingEnabled || !browserEventsEnabled) return;
  trackMetaPixelPageView(path);
}

export function getTrackingOwnerId(): string | null {
  return trackingOwnerId;
}

export { trackGoogleEvent, isMetaPixelLoaded };
