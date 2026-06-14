import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { flushOwnerCache } from '@/lib/cache';

const DEBOUNCE_MS = 1500;

export type OrderRealtimeEvent =
  | { type: 'insert'; orderId: string }
  | { type: 'update'; orderId: string; status?: string; paymentStatus?: string }
  | { type: 'refetch' };

export const useRealtimeOrders = (
  onChange?: () => void,
  onEvent?: (event: OrderRealtimeEvent) => void
) => {
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (user?.id) flushOwnerCache(user.id);
      onChange?.();
      onEvent?.({ type: 'refetch' });
    }, DEBOUNCE_MS);
  }, [onChange, onEvent, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`orders-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `owner_id=eq.${user.id}`,
        },
        (payload) => {
          const orderId = String((payload.new as { id?: string })?.id ?? '');
          if (orderId) {
            onEvent?.({ type: 'insert', orderId });
          }
          scheduleRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `owner_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; status?: string; payment_status?: string };
          const orderId = String(row?.id ?? '');
          if (orderId) {
            onEvent?.({
              type: 'update',
              orderId,
              status: row.status,
              paymentStatus: row.payment_status,
            });
          }
          scheduleRefetch();
        }
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [user?.id, scheduleRefetch, onEvent]);
};
