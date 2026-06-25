import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { appendCachedProduct, patchCachedProduct, removeCachedProduct } from '@/services/productService';
import { invalidateStorefrontForOwner } from '@/services/storefrontProductService';
import { mapDbProduct } from '@/mappers/productMapper';
import { isStorefrontVisible } from '@/lib/productLifecycle';
import { subscribeMerchantProducts, type ProductRealtimePayload } from '@/lib/merchantRealtimeHub';

const STOREFRONT_FIELDS = new Set([
  'stock_quantity',
  'variants',
  'price',
  'original_price',
  'discount_type',
  'discount_value',
  'discount_start_date',
  'discount_end_date',
  'is_active',
  'archived_at',
  'name',
  'description',
  'short_description',
  'category',
  'image_url',
  'additional_images',
  'sizes',
  'colors',
  'product_slug',
  'tags',
]);

const shouldInvalidateStorefront = (payload: ProductRealtimePayload): boolean => {
  if (payload.eventType === 'DELETE') return true;
  const row = payload.new;
  if (!row) return false;
  return Object.keys(row).some((key) => STOREFRONT_FIELDS.has(key));
};

export const useRealtimeProducts = (onUpdate?: () => void) => {
  const { user } = useAuth();
  const onUpdateRef = useRef(onUpdate);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const scheduleParentUpdate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onUpdateRef.current?.();
    }, 300);
  }, []);

  const handleChange = useCallback(
    (payload: ProductRealtimePayload) => {
      const ownerId = user?.id;
      if (!ownerId) return;

      if (payload.eventType === 'UPDATE' && payload.new) {
        patchCachedProduct(ownerId, payload.new);
        if (shouldInvalidateStorefront(payload)) {
          void invalidateStorefrontForOwner(ownerId);
        }
        scheduleParentUpdate();
        return;
      }

      if (payload.eventType === 'DELETE' && payload.old?.id) {
        removeCachedProduct(ownerId, String(payload.old.id));
        void invalidateStorefrontForOwner(ownerId);
        scheduleParentUpdate();
        return;
      }

      if (payload.eventType === 'INSERT' && payload.new) {
        appendCachedProduct(ownerId, payload.new);
        const mapped = mapDbProduct(payload.new);
        if (isStorefrontVisible(mapped)) {
          void invalidateStorefrontForOwner(ownerId);
        }
        scheduleParentUpdate();
      }
    },
    [user?.id, scheduleParentUpdate]
  );

  useEffect(() => {
    if (!user?.id) return;
    return subscribeMerchantProducts(user.id, handleChange);
  }, [user?.id, handleChange]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );
};
