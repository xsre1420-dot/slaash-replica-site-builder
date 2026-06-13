import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { flushOwnerCache } from '@/lib/cache';

const DEBOUNCE_MS = 2500;

export const useRealtimeOrders = (onNewOrder?: () => void) => {
  const { user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (user?.id) flushOwnerCache(user.id);
      onNewOrder?.();
    }, DEBOUNCE_MS);
  }, [onNewOrder, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`orders-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `owner_id=eq.${user.id}`,
        },
        handleChange
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleChange]);
};
