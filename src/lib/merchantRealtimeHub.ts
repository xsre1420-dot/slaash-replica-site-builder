/**
 * Shared Supabase Realtime channels — one channel per table per merchant.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { flushOrderCache } from '@/lib/cache';

export type ProductRealtimePayload = {
  eventType: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};

export type OrderRealtimeEvent =
  | { type: 'insert'; orderId: string }
  | { type: 'update'; orderId: string; status?: string; paymentStatus?: string }
  | { type: 'refetch' };

type ProductHandler = (payload: ProductRealtimePayload) => void;
type OrderChangeHandler = () => void;
type OrderEventHandler = (event: OrderRealtimeEvent) => void;

interface ProductEntry {
  channel: RealtimeChannel;
  handlers: Set<ProductHandler>;
}

interface OrderEntry {
  channel: RealtimeChannel;
  handlers: Set<{ onChange?: OrderChangeHandler; onEvent?: OrderEventHandler }>;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

const productEntries = new Map<string, ProductEntry>();
const orderEntries = new Map<string, OrderEntry>();

const ORDER_DEBOUNCE_MS = 500;

function scheduleOrderRefetch(userId: string, entry: OrderEntry) {
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  entry.debounceTimer = setTimeout(() => {
    entry.debounceTimer = null;
    flushOrderCache(userId);
    for (const h of entry.handlers) {
      h.onChange?.();
      h.onEvent?.({ type: 'refetch' });
    }
  }, ORDER_DEBOUNCE_MS);
}

export function subscribeMerchantProducts(userId: string, handler: ProductHandler): () => void {
  let entry = productEntries.get(userId);
  if (!entry) {
    const handlers = new Set<ProductHandler>();
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
          const normalized: ProductRealtimePayload = {
            eventType: payload.eventType,
            new: payload.new as Record<string, unknown> | undefined,
            old: payload.old as Record<string, unknown> | undefined,
          };
          handlers.forEach((h) => h(normalized));
        }
      )
      .subscribe();
    entry = { channel, handlers };
    productEntries.set(userId, entry);
  }

  entry.handlers.add(handler);
  return () => {
    const current = productEntries.get(userId);
    if (!current) return;
    current.handlers.delete(handler);
    if (current.handlers.size === 0) {
      void supabase.removeChannel(current.channel);
      productEntries.delete(userId);
    }
  };
}

export function subscribeMerchantOrders(
  userId: string,
  onChange?: OrderChangeHandler,
  onEvent?: OrderEventHandler
): () => void {
  let entry = orderEntries.get(userId);
  if (!entry) {
    const handlers = new Set<{ onChange?: OrderChangeHandler; onEvent?: OrderEventHandler }>();
    const debounceTimer: ReturnType<typeof setTimeout> | null = null;

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
          const orderId = String((payload.new as { id?: string })?.id ?? '');
          const current = orderEntries.get(userId);
          if (!current) return;
          if (orderId) {
            for (const h of current.handlers) {
              h.onEvent?.({ type: 'insert', orderId });
            }
          }
          scheduleOrderRefetch(userId, current);
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
          const row = payload.new as { id?: string; status?: string; payment_status?: string };
          const orderId = String(row?.id ?? '');
          const current = orderEntries.get(userId);
          if (!current) return;
          if (orderId) {
            for (const h of current.handlers) {
              h.onEvent?.({
                type: 'update',
                orderId,
                status: row?.status,
                paymentStatus: row?.payment_status,
              });
            }
          }
          scheduleOrderRefetch(userId, current);
        }
      )
      .subscribe();

    entry = { channel, handlers, debounceTimer };
    orderEntries.set(userId, entry);
  }

  const listener = { onChange, onEvent };
  entry.handlers.add(listener);

  return () => {
    const current = orderEntries.get(userId);
    if (!current) return;
    current.handlers.delete(listener);
    if (current.handlers.size === 0) {
      if (current.debounceTimer) clearTimeout(current.debounceTimer);
      void supabase.removeChannel(current.channel);
      orderEntries.delete(userId);
    }
  };
}
