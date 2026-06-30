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
import { enqueueCacheInvalidationForOwner } from '@/background/enqueue';
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

interface MerchantRealtimeEntry {
  channel: RealtimeChannel | null;
  productUiHandlers: Set<ProductUiHandler>;
  orderHandlers: Set<{ onChange?: OrderChangeHandler; onEvent?: OrderEventHandler }>;
  productUiDebounceTimer: ReturnType<typeof setTimeout> | null;
  orderDebounceTimer: ReturnType<typeof setTimeout> | null;
  pendingUiNotify: boolean;
  pendingRefetch: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number;
}

const merchantEntries = new Map<string, MerchantRealtimeEntry>();

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
const MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 45_000;
const REALTIME_HEARTBEAT_MS = 25_000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHookInstalled = false;

function startRealtimeHeartbeat() {
  if (heartbeatTimer || typeof window === 'undefined') return;
  heartbeatTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    for (const entry of merchantEntries.values()) {
      if (entry.channel && (entry.productUiHandlers.size > 0 || entry.orderHandlers.size > 0)) {
        void entry.channel.send({ type: 'broadcast', event: 'heartbeat', payload: { t: Date.now() } });
      }
    }
  }, REALTIME_HEARTBEAT_MS);
}

function stopRealtimeHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function installVisibilityHook() {
  if (visibilityHookInstalled || typeof document === 'undefined') return;
  visibilityHookInstalled = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;

    for (const [userId, entry] of merchantEntries) {
      if (entry.pendingUiNotify) {
        entry.pendingUiNotify = false;
        flushProductUiHandlers(userId, entry);
      }
      if (entry.pendingRefetch) {
        entry.pendingRefetch = false;
        scheduleOrderRefetch(userId, entry, true);
      }
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
      const entry = merchantEntries.get(userId);
      if (entry?.channel === channel) entry.reconnectAttempt = 0;
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
  const entry = merchantEntries.get(userId);
  if (!entry || entry.channel !== channel) return;
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

function flushProductUiHandlers(userId: string, entry: MerchantRealtimeEntry) {
  hubMetrics.productUiFlushes += 1;
  for (const handler of entry.productUiHandlers) handler();
}

function scheduleProductUiNotify(userId: string, entry: MerchantRealtimeEntry) {
  if (typeof document !== 'undefined' && document.hidden) {
    entry.pendingUiNotify = true;
    return;
  }

  if (entry.productUiDebounceTimer) clearTimeout(entry.productUiDebounceTimer);
  entry.productUiDebounceTimer = setTimeout(() => {
    entry.productUiDebounceTimer = null;
    flushProductUiHandlers(userId, entry);
  }, PRODUCT_UI_DEBOUNCE_MS);
}

function maybeInvalidateStorefront(userId: string) {
  if (shouldSuppressRealtimeStorefrontInvalidation(userId)) return;
  enqueueCacheInvalidationForOwner(userId);
}

function applyProductPayload(userId: string, payload: ProductRealtimePayload) {
  const entry = merchantEntries.get(userId);
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

function ensureMerchantChannel(userId: string): MerchantRealtimeEntry {
  installVisibilityHook();
  startRealtimeHeartbeat();

  let entry = merchantEntries.get(userId);
  if (entry?.channel) return entry;

  if (!entry) {
    entry = {
      channel: null,
      productUiHandlers: new Set(),
      orderHandlers: new Set(),
      productUiDebounceTimer: null,
      orderDebounceTimer: null,
      pendingUiNotify: false,
      pendingRefetch: false,
      reconnectTimer: null,
      reconnectAttempt: 0,
    };
    merchantEntries.set(userId, entry);
  }

  const resubscribe = () => ensureMerchantChannel(userId);

  const handleOrderPayload = (payload: {
    eventType: string;
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => {
    hubMetrics.orderEventsReceived += 1;
    const current = merchantEntries.get(userId);
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
      for (const h of current.orderHandlers) {
        h.onEvent?.({
          type: 'update',
          orderId,
          status: row?.status,
          paymentStatus: row?.payment_status,
        });
      }
    } else if (payload.eventType === 'INSERT') {
      for (const h of current.orderHandlers) {
        h.onEvent?.({ type: 'insert', orderId });
      }
    }

    scheduleOrderRefetch(userId, current);
  };

  const channel = supabase
    .channel(`merchant-realtime-${userId}`)
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
    )
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

function scheduleOrderRefetch(userId: string, entry: MerchantRealtimeEntry, immediate = false) {
  if (!immediate && typeof document !== 'undefined' && document.hidden) {
    entry.pendingRefetch = true;
    return;
  }

  if (entry.orderDebounceTimer) clearTimeout(entry.orderDebounceTimer);
  entry.orderDebounceTimer = setTimeout(() => {
    entry.orderDebounceTimer = null;
    entry.pendingRefetch = false;
    hubMetrics.orderRefetchFlushes += 1;
    flushOrderCache(userId);
    for (const h of entry.orderHandlers) {
      h.onChange?.();
    }
  }, immediate ? 0 : ORDER_DEBOUNCE_MS);
}

function teardownEntryIfIdle(userId: string, entry: MerchantRealtimeEntry) {
  if (entry.productUiHandlers.size > 0 || entry.orderHandlers.size > 0) return;
  if (entry.productUiDebounceTimer) clearTimeout(entry.productUiDebounceTimer);
  if (entry.orderDebounceTimer) clearTimeout(entry.orderDebounceTimer);
  if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
  entry.pendingUiNotify = false;
  entry.pendingRefetch = false;
  if (entry.channel) void supabase.removeChannel(entry.channel);
  merchantEntries.delete(userId);
  if (merchantEntries.size === 0) {
    stopRealtimeHeartbeat();
  }
}

export function subscribeMerchantProducts(userId: string, onUiUpdate: ProductUiHandler): () => void {
  const entry = ensureMerchantChannel(userId);
  entry.productUiHandlers.add(onUiUpdate);

  return () => {
    const current = merchantEntries.get(userId);
    if (!current) return;
    current.productUiHandlers.delete(onUiUpdate);
    teardownEntryIfIdle(userId, current);
  };
}

export function subscribeMerchantOrders(
  userId: string,
  onChange?: OrderChangeHandler,
  onEvent?: OrderEventHandler
): () => void {
  const entry = ensureMerchantChannel(userId);
  const listener = { onChange, onEvent };
  entry.orderHandlers.add(listener);

  return () => {
    const current = merchantEntries.get(userId);
    if (!current) return;
    current.orderHandlers.delete(listener);
    teardownEntryIfIdle(userId, current);
  };
}

/** Force reconnect unified merchant channel (manual recovery). */
export function forceReconnectMerchantRealtime(userId: string): void {
  const entry = merchantEntries.get(userId);
  if (!entry) return;

  if (entry.productUiDebounceTimer) clearTimeout(entry.productUiDebounceTimer);
  if (entry.orderDebounceTimer) clearTimeout(entry.orderDebounceTimer);
  if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
  if (entry.channel) void supabase.removeChannel(entry.channel);
  entry.channel = null;
  entry.reconnectAttempt = 0;
  entry.pendingUiNotify = false;
  entry.pendingRefetch = false;
  ensureMerchantChannel(userId);
}

export function teardownMerchantRealtimeHub(): void {
  for (const [, entry] of merchantEntries) {
    if (entry.productUiDebounceTimer) clearTimeout(entry.productUiDebounceTimer);
    if (entry.orderDebounceTimer) clearTimeout(entry.orderDebounceTimer);
    if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
    if (entry.channel) void supabase.removeChannel(entry.channel);
  }
  merchantEntries.clear();
  stopRealtimeHeartbeat();
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

  for (const entry of merchantEntries.values()) {
    productHandlerCount += entry.productUiHandlers.size;
    orderHandlerCount += entry.orderHandlers.size;
    if (entry.reconnectTimer) pendingReconnects += 1;
    if (entry.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) maxAttemptsExceeded += 1;
  }

  const channelsWithHandlers = [...merchantEntries.values()].filter(
    (e) => e.productUiHandlers.size > 0 || e.orderHandlers.size > 0
  ).length;

  return {
    activeProductChannels: channelsWithHandlers,
    activeOrderChannels: channelsWithHandlers,
    productHandlerCount,
    orderHandlerCount,
    pendingReconnects,
    maxAttemptsExceeded,
    metrics: buildHubMetrics(),
  };
}
