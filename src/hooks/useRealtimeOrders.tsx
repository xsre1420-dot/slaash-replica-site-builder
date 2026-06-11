import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cache } from '@/lib/cache';

export const useRealtimeOrders = (onNewOrder?: () => void) => {
  const { user } = useAuth();

  const handleChange = useCallback(() => {
    cache.flushByPrefix('orders:');
    cache.flushByPrefix('stats:');
    onNewOrder?.();
  }, [onNewOrder]);

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
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleChange]);
};
