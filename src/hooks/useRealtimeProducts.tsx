
/**
 * Suggestion #11: Realtime subscriptions for products
 * Sync products instantly across devices without reload
 */

import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { invalidateCache, loadProducts } from '@/data/dummyData';
import { toast } from 'sonner';

export const useRealtimeProducts = (onUpdate?: () => void) => {
  const { user } = useAuth();

  const handleChange = useCallback((payload: any) => {
    console.log('[Realtime] Products changed:', payload.eventType);
    // Invalidate cache and reload
    invalidateCache();
    loadProducts(true).then(() => {
      onUpdate?.();
    });
  }, [onUpdate]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('products-realtime')
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to products changes');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleChange]);
};
