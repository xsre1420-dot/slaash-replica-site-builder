/**
 * Shared Supabase Realtime channels — one WebSocket channel per table per merchant.
 * Cache patching is centralized here so multiple UI hooks never duplicate work.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { flushOrderCache } from '@/lib/cache';
import {
  appendCachedProduct,
  patchCachedProduct,
  removeCachedProduct,
} from '@/services/productService';
import { invalidateStorefrontForOwner } from '@/services/storefrontProductService';
import { patchStorefrontProductFromDbRow } from '@/services/storefrontCacheService';
import { markLocalStorefrontMutation, shouldSuppressRealtimeStorefrontInvalidation } from '@/lib/localMutationGuard';
import { mapDbProduct } from '@/mappers/productMapper';
import { isStorefrontVisible } from '@/lib/productLifecycle';
import {
  getChangedFieldKeys,
  isNoiseOnlyChange,
  isStockOnlyStorefrontChange,
  ORDER_NOISE_FIELDS,
  PRODUCT_NOISE_FIELDS,
  shouldInvalidateStorefront,
} from '@/lib/merchantRealtimeUtils';
import { recordHealthEvent } from '@/lib/observability/healthMonitor';

type ProductRealtimePayload = {
  eventType: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

export type OrderRealtimeEvent =
  | { type: 'insert'; orderId: string }
  | { type: 'update'; orderId: string; status?: string; paymentStatus?: string };

type ProductUiHandler = () => void;
type OrderChangeHandler = () => void;
type OrderEventHandler = (event: OrderRealtimeEvent) => void;

interface ProductEntry {
  channel: RealtimeChannel | null;
  uiHandlers: Set<ProductUiHandler>;
  uiDebounceTimer: ReturnType<typeof setTimeout> | null;
  pendingUiNotify: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number;
}

interface OrderEntry {
  channel: RealtimeChannel | null;
  handlers: Set<{ onChange?: OrderChangeHandler; onEvent?: OrderEventHandler }>;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  pendingRefetch: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number;
}

const productEntries = new Map<string, ProductEntry>();
const orderEntries = new Map<string, OrderEntry>();

/** In-process counters for ops / health dashboards (resets on page reload). */
const hubMetrics = {
  productEventsReceived: 0,
  productEventsFiltered: 0,
  productUiFlushes: 0,
  orderEventsReceived: 0,
  orderEventsFiltered: 0,
  orderRefetchFlushes: 0,
};

const ORDER_DEBOUNCE_MS = 500;
const PRODUCT_UI_DEBOUNCE_MS = 300;
const MAX_RECONNECT_ATTEMPTS = 6;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

let visibilityHookInstalled = false;

function installVisibilityHook() {
  if (visibilityHookInstalled || typeof document === 'undefined') return;
  visibilityHookInstalled = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;

    for (const [userId, entry] of productEntries) {
      if (!entry.pendingUiNotify) continue;
      entry.pendingUiNotify = false;
      flushProductUiHandlers(userId, entry);
    }

    for (const [userId, entry] of orderEntries) {
      if (!entry.pendingRefetch) continue;
      entry.pendingRefetch = false;
      scheduleOrderRefetch(userId, entry, true);
    }
  });
}

function reconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
}

function watchChannelStatus(
  userId: string,
  channel: RealtimeChannel,
  resubscribe: () => void
): void {
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      const productEntry = productEntries.get(userId);
      if (productEntry?.channel === channel) productEntry.reconnectAttempt = 0;
      const orderEntry = orderEntries.get(userId);
      if (orderEntry?.channel === channel) orderEntry.reconnectAttempt = 0;
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      scheduleChannelReconnect(userId, channel, resubscribe);
    }
  });
}

function scheduleChannelReconnect(
  userId: string,
  channel: RealtimeChannel,
  resubscribe: () => void
): void {
  const productEntry = productEntries.get(userId);
  const orderEntry = orderEntries.get(userId);
  const entry = productEntry?.channel === channel ? productEntry : orderEntry?.channel === channel ? orderEntry : null;
  if (!entry) return;
  if (entry.reconnectTimer) return;
  if (entry.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
    recordHealthEvent('realtime', false, { message: `max reconnect attempts for ${userId}` });
    return;
  }

  const delay = reconnectDelay(entry.reconnectAttempt);
  entry.reconnectAttempt += 1;
  entry.reconnectTimer = setTimeout(() => {
    entry.reconnectTimer = null;
    if (entry.channel === channel) {
      void supabase.removeChannel(channel);
      entry.channel = null;
    }
    resubscribe();
  }, delay);
}

function flushProductUiHandlers(userId: string, entry: ProductEntry) {
  hubMetrics.productUiFlushes += 1;
  for (const handler of entry.uiHandlers) handler();
}

function scheduleProductUiNotify(userId: string, entry: ProductEntry) {
  if (typeof document !== 'undefined' && document.hidden) {
    entry.pendingUiNotify = true;
    return;
  }

  if (entry.uiDebounceTimer) clearTimeout(entry.uiDebounceTimer);
  entry.uiDebounceTimer = setTimeout(() => {
    entry.uiDebounceTimer = null;
    flushProductUiHandlers(userId, entry);
  }, PRODUCT_UI_DEBOUNCE_MS);
}

function maybeInvalidateStorefront(userId: string) {
  if (shouldSuppressRealtimeStorefrontInvalidation(userId)) return;
  void invalidateStorefrontForOwner(userId);
}

function applyProductPayload(userId: string, payload: ProductRealtimePayload) {
  const entry = productEntries.get(userId);
  if (!entry) return;

  hubMetrics.productEventsReceived += 1;

  if (payload.eventType === 'UPDATE') {
    const changed = getChangedFieldKeys(payload.new, payload.old);
    if (isNoiseOnlyChange(changed, PRODUCT_NOISE_FIELDS)) {
      hubMetrics.productEventsFiltered += 1;
      return;
    }

    if (payload.new) {
      patchCachedProduct(userId, payload.new);
      if (shouldInvalidateStorefront(payload)) {
        const changed = getChangedFieldKeys(payload.new, payload.old);
        if (isStockOnlyStorefrontChange(changed)) {
          markLocalStorefrontMutation(userId);
          void patchStorefrontProductFromDbRow(userId, payload.new);
        } else {
          maybeInvalidateStorefront(userId);
        }
      }
      scheduleProductUiNotify(userId, entry);
    }
    return;
  }

  if (payload.eventType === 'DELETE' && payload.old?.id) {
    removeCachedProduct(userId, String(payload.old.id));
    maybeInvalidateStorefront(userId);
    scheduleProductUiNotify(userId, entry);
    return;
  }

  if (payload.eventType === 'INSERT' && payload.new) {
    appendCachedProduct(userId, payload.new);
    const mapped = mapDbProduct(payload.new);
    if (isStorefrontVisible(mapped)) {
      maybeInvalidateStorefront(userId);
    }
    scheduleProductUiNotify(userId, entry);
  }
}

function ensureProductChannel(userId: string): ProductEntry {
  installVisibilityHook();

  let entry = productEntries.get(userId);
  if (entry?.channel) return entry;

  if (!entry) {
    entry = {
      channel: null,
      uiHandlers: new Set(),
      uiDebounceTimer: null,
      pendingUiNotify: false,
      reconnectTimer: null,
      reconnectAttempt: 0,
    };
    productEntries.set(userId, entry);
  }

  const resubscribe = () => ensureProductChannel(userId);
  const channel = supabase
    .channel(`products-realtime-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `owner_id=eq.${userId}`,
      },
      (payload) => {
        applyProductPayload(userId, {
          eventType: payload.eventType,
          new: payload.new as Record<string, unknown> | undefined,
          old: payload.old as Record<string, unknown> | undefined,
        });
      }
    );

  entry.channel = channel;
  watchChannelStatus(userId, channel, resubscribe);
  return entry;
}

function ensureOrderChannel(userId: string): OrderEntry {
  installVisibilityHook();

  let entry = orderEntries.get(userId);
  if (entry?.channel) return entry;

  if (!entry) {
    entry = {
      channel: null,
      handlers: new Set(),
      debounceTimer: null,
      pendingRefetch: false,
      reconnectTimer: null,
      reconnectAttempt: 0,
    };
    orderEntries.set(userId, entry);
  }

  const resubscribe = () => ensureOrderChannel(userId);

  const handleOrderPayload = (payload: {
    eventType: string;
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => {
    hubMetrics.orderEventsReceived += 1;
    const current = orderEntries.get(userId);
    if (!current) return;

    const orderId = String((payload.new as { id?: string })?.id ?? '');
    if (!orderId) return;

    if (payload.eventType === 'UPDATE') {
      const changed = getChangedFieldKeys(payload.new, payload.old);
      if (isNoiseOnlyChange(changed, ORDER_NOISE_FIELDS)) {
        hubMetrics.orderEventsFiltered += 1;
        return;
      }

      const row = payload.new as { status?: string; payment_status?: string };
      for (const h of current.handlers) {
        h.onEvent?.({
          type: 'update',
          orderId,
          status: row?.status,
          paymentStatus: row?.payment_status,
        });
      }
    } else if (payload.eventType === 'INSERT') {
      for (const h of current.handlers) {
        h.onEvent?.({ type: 'insert', orderId });
      }
    }

    scheduleOrderRefetch(userId, current);
  };

  const channel = supabase
    .channel(`orders-realtime-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `owner_id=eq.${userId}`,
      },
      (payload) => {
        handleOrderPayload({
          eventType: payload.eventType,
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `owner_id=eq.${userId}`,
      },
      (payload) => {
        handleOrderPayload({
          eventType: payload.eventType,
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown>,
        });
      }
    );

  entry.channel = channel;
  watchChannelStatus(userId, channel, resubscribe);
  return entry;
}

function scheduleOrderRefetch(userId: string, entry: OrderEntry, immediate = false) {
  if (!immediate && typeof document !== 'undefined' && document.hidden) {
    entry.pendingRefetch = true;
    return;
  }

  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  entry.debounceTimer = setTimeout(() => {
    entry.debounceTimer = null;
    entry.pendingRefetch = false;
    hubMetrics.orderRefetchFlushes += 1;
    flushOrderCache(userId);
    for (const h of entry.handlers) {
      h.onChange?.();
    }
  }, immediate ? 0 : ORDER_DEBOUNCE_MS);
}

/** UI-only subscription; product cache is patched once inside the hub. */
export function subscribeMerchantProducts(userId: string, onUiUpdate: ProductUiHandler): () => void {
  const entry = ensureProductChannel(userId);
  entry.uiHandlers.add(onUiUpdate);

  return () => {
    const current = productEntries.get(userId);
    if (!current) return;
    current.uiHandlers.delete(onUiUpdate);
    if (current.uiHandlers.size === 0) {
      if (current.uiDebounceTimer) clearTimeout(current.uiDebounceTimer);
      if (current.reconnectTimer) clearTimeout(current.reconnectTimer);
      if (current.channel) void supabase.removeChannel(current.channel);
      productEntries.delete(userId);
    }
  };
}

export function subscribeMerchantOrders(
  userId: string,
  onChange?: OrderChangeHandler,
  onEvent?: OrderEventHandler
): () => void {
  const entry = ensureOrderChannel(userId);
  const listener = { onChange, onEvent };
  entry.handlers.add(listener);

  return () => {
    const current = orderEntries.get(userId);
    if (!current) return;
    current.handlers.delete(listener);
    if (current.handlers.size === 0) {
      if (current.debounceTimer) clearTimeout(current.debounceTimer);
      if (current.reconnectTimer) clearTimeout(current.reconnectTimer);
      if (current.channel) void supabase.removeChannel(current.channel);
      orderEntries.delete(userId);
    }
  };
}

/** Force reconnect product + order channels (merchant manual recovery). */
export function forceReconnectMerchantRealtime(userId: string): void {
  const productEntry = productEntries.get(userId);
  if (productEntry) {
    if (productEntry.uiDebounceTimer) clearTimeout(productEntry.uiDebounceTimer);
    if (productEntry.reconnectTimer) clearTimeout(productEntry.reconnectTimer);
    if (productEntry.channel) void supabase.removeChannel(productEntry.channel);
    productEntry.channel = null;
    productEntry.reconnectAttempt = 0;
    productEntry.pendingUiNotify = false;
    ensureProductChannel(userId);
  }

  const orderEntry = orderEntries.get(userId);
  if (orderEntry) {
    if (orderEntry.debounceTimer) clearTimeout(orderEntry.debounceTimer);
    if (orderEntry.reconnectTimer) clearTimeout(orderEntry.reconnectTimer);
    if (orderEntry.channel) void supabase.removeChannel(orderEntry.channel);
    orderEntry.channel = null;
    orderEntry.reconnectAttempt = 0;
    orderEntry.pendingRefetch = false;
    ensureOrderChannel(userId);
  }
}

/** Drop all merchant channels — call before replacing the Supabase client. */
export function teardownMerchantRealtimeHub(): void {
  for (const [, entry] of productEntries) {
    if (entry.uiDebounceTimer) clearTimeout(entry.uiDebounceTimer);
    if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
    if (entry.channel) void supabase.removeChannel(entry.channel);
  }
  productEntries.clear();

  for (const [, entry] of orderEntries) {
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
    if (entry.channel) void supabase.removeChannel(entry.channel);
  }
  orderEntries.clear();
}

export type MerchantRealtimeHubMetrics = {
  productEventsReceived: number;
  productEventsFiltered: number;
  productUiFlushes: number;
  orderEventsReceived: number;
  orderEventsFiltered: number;
  orderRefetchFlushes: number;
  productFilterRate: number;
  orderFilterRate: number;
};

export type MerchantRealtimeHubStatus = {
  activeProductChannels: number;
  activeOrderChannels: number;
  productHandlerCount: number;
  orderHandlerCount: number;
  pendingReconnects: number;
  maxAttemptsExceeded: number;
  metrics: MerchantRealtimeHubMetrics;
};

function buildHubMetrics(): MerchantRealtimeHubMetrics {
  const productFilterRate =
    hubMetrics.productEventsReceived > 0
      ? hubMetrics.productEventsFiltered / hubMetrics.productEventsReceived
      : 0;
  const orderFilterRate =
    hubMetrics.orderEventsReceived > 0
      ? hubMetrics.orderEventsFiltered / hubMetrics.orderEventsReceived
      : 0;

  return {
    ...hubMetrics,
    productFilterRate: Math.round(productFilterRate * 1000) / 1000,
    orderFilterRate: Math.round(orderFilterRate * 1000) / 1000,
  };
}

/** Reset in-process event counters (tests / admin diagnostics). */
export function resetMerchantRealtimeHubMetricsForTests(): void {
  hubMetrics.productEventsReceived = 0;
  hubMetrics.productEventsFiltered = 0;
  hubMetrics.productUiFlushes = 0;
  hubMetrics.orderEventsReceived = 0;
  hubMetrics.orderEventsFiltered = 0;
  hubMetrics.orderRefetchFlushes = 0;
}

/** Snapshot for platform health dashboard (in-process client state). */
export function getMerchantRealtimeHubStatus(): MerchantRealtimeHubStatus {
  let pendingReconnects = 0;
  let maxAttemptsExceeded = 0;
  let productHandlerCount = 0;
  let orderHandlerCount = 0;

  for (const entry of productEntries.values()) {
    productHandlerCount += entry.uiHandlers.size;
    if (entry.reconnectTimer) pendingReconnects += 1;
    if (entry.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) maxAttemptsExceeded += 1;
  }
  for (const entry of orderEntries.values()) {
    orderHandlerCount += entry.handlers.size;
    if (entry.reconnectTimer) pendingReconnects += 1;
    if (entry.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) maxAttemptsExceeded += 1;
  }

  return {
    activeProductChannels: productEntries.size,
    activeOrderChannels: orderEntries.size,
    productHandlerCount,
    orderHandlerCount,
    pendingReconnects,
    maxAttemptsExceeded,
    metrics: buildHubMetrics(),
  };
}
