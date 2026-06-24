import { useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { appendCachedProduct, patchCachedProduct, removeCachedProduct } from '@/services/productService';
import { invalidateStorefrontForOwner } from '@/services/storefrontProductService';
import { mapDbProduct } from '@/mappers/productMapper';
import { isStorefrontVisible } from '@/lib/productLifecycle';
import { subscribeMerchantProducts, type ProductRealtimePayload } from '@/lib/merchantRealtimeHub';

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

const shouldInvalidateStorefront = (payload: ProductRealtimePayload): boolean => {
  if (payload.eventType === 'DELETE') return true;
  const row = payload.new;
  if (!row) return false;
  return Object.keys(row).some((key) => STOCK_FIELDS.has(key));
};

export const useRealtimeProducts = (onUpdate?: () => void) => {
  const { user } = useAuth();

  const handleChange = useCallback(
    (payload: ProductRealtimePayload) => {
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
    },
    [user?.id, onUpdate]
  );

  useEffect(() => {
    if (!user?.id) return;
    return subscribeMerchantProducts(user.id, handleChange);
  }, [user?.id, handleChange]);
};
