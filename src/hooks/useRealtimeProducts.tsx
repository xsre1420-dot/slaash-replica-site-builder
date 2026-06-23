import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { appendCachedProduct, patchCachedProduct, removeCachedProduct } from '@/services/productService';
import { invalidateStorefrontForOwner } from '@/services/storefrontProductService';
import { mapDbProduct } from '@/mappers/productMapper';
import { isStorefrontVisible } from '@/lib/productLifecycle';

const STOCK_FIELDS = new Set([
  'stock_quantity',
  'variants',
  'price',
  'original_price',
  'discount_type',
  'discount_value',
  'is_active',
  'archived_at',
]);

const shouldInvalidateStorefront = (payload: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }): boolean => {
  if (payload.eventType === 'DELETE') return true;
  const row = payload.new;
  if (!row) return false;
  return Object.keys(row).some((key) => STOCK_FIELDS.has(key));
};

export const useRealtimeProducts = (onUpdate?: () => void) => {
  const { user } = useAuth();

  const handleChange = useCallback((payload: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
    const ownerId = user?.id;
    if (!ownerId) return;

    if (payload.eventType === 'UPDATE' && payload.new) {
      patchCachedProduct(ownerId, payload.new);
      if (shouldInvalidateStorefront(payload)) {
        void invalidateStorefrontForOwner(ownerId);
      }
      onUpdate?.();
      return;
    }

    if (payload.eventType === 'DELETE' && payload.old?.id) {
      removeCachedProduct(ownerId, String(payload.old.id));
      void invalidateStorefrontForOwner(ownerId);
      onUpdate?.();
      return;
    }

    if (payload.eventType === 'INSERT' && payload.new) {
      appendCachedProduct(ownerId, payload.new);
      const mapped = mapDbProduct(payload.new);
      if (isStorefrontVisible(mapped)) {
        void invalidateStorefrontForOwner(ownerId);
      }
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
