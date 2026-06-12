
/**
 * Realtime subscriptions for products — patch cache on UPDATE instead of full reload
 */

import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { appendCachedProduct, patchCachedProduct, removeCachedProduct } from '@/data/dummyData';

export const useRealtimeProducts = (onUpdate?: () => void) => {
  const { user } = useAuth();

  const handleChange = useCallback((payload: any) => {
    const ownerId = user?.id;
    if (!ownerId) return;

    if (payload.eventType === 'UPDATE' && payload.new) {
      patchCachedProduct(ownerId, payload.new);
      onUpdate?.();
      return;
    }

    if (payload.eventType === 'DELETE' && payload.old?.id) {
      removeCachedProduct(ownerId, payload.old.id);
      onUpdate?.();
      return;
    }

    if (payload.eventType === 'INSERT' && payload.new) {
      appendCachedProduct(ownerId, payload.new);
      onUpdate?.();
    }
  }, [user?.id, onUpdate]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`products-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
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
