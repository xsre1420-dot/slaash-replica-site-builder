/** Meta Pixel + Conversions API shared types (browser-safe — no secrets). */

export type MetaStandardEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'AddToWishlist'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Purchase'
  | 'Lead'
  | 'Contact'
  | 'CompleteRegistration';

export interface MetaEventCustomData {
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  content_category?: string;
  contents?: Array<{ id: string; quantity?: number; item_price?: number }>;
  value?: number;
  currency?: string;
  num_items?: number;
  search_string?: string;
  status?: boolean;
}

export interface MetaTrackOptions {
  /** Shared with CAPI for deduplication — required for Purchase and recommended for all events. */
  eventId: string;
  eventSourceUrl?: string;
}

export type MetaDiagnosticsChannel = 'browser' | 'server';

export interface MetaDiagnosticEntry {
  id: string;
  timestamp: string;
  channel: MetaDiagnosticsChannel;
  eventName: MetaStandardEventName | string;
  eventId: string;
  pixelId?: string;
  success: boolean;
  deduplicationKey?: string;
  payload?: Record<string, unknown>;
  metaResponse?: unknown;
  error?: string;
  retryCount?: number;
  matchQualityHints?: string[];
}

export interface MetaPixelRuntimeState {
  loaded: boolean;
  pixelId: string | null;
  ownerId: string | null;
  marketingEnabled: boolean;
  browserEventsEnabled: boolean;
  debugMode: boolean;
  lastPageViewPath: string | null;
  scriptInjected: boolean;
}

export interface MetaBrowserContext {
  fbp: string | null;
  fbc: string | null;
  eventSourceUrl: string;
}

export interface MetaCapiPurchasePayload {
  store_slug: string;
  order_id: string;
  event_id: string;
  value: number;
  currency?: string;
  content_ids?: string[];
  num_items?: number;
  customer_phone?: string | null;
  customer_email?: string | null;
  external_id?: string | null;
  event_source_url?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}
