import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  loadProductsPage,
  getCategories,
  setCurrentStore,
  invalidateOwnerCache,
} from '@/services/productService';
import { bootstrapOwnerStore } from '@/services/storeService';
import { OWNER_PRODUCTS_PAGE_SIZE } from '@/constants/pagination';

/**
 * Phase 1: On login, load store record + products + categories + orders metadata.
 * Uses combined RPC when available, falls back to parallel requests.
 */
export const useStoreBootstrap = () => {
  const { user, loading } = useAuth();
  const bootstrappedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user?.id) {
      bootstrappedFor.current = null;
      setCurrentStore(null);
      return;
    }

    if (bootstrappedFor.current === user.id) return;
    bootstrappedFor.current = user.id;

    const run = async () => {
      invalidateOwnerCache(user.id);

      const bootstrapped = await bootstrapOwnerStore(user.id);
      if (bootstrapped?.storeId) {
        setCurrentStore(bootstrapped.storeId);
        return;
      }

      await Promise.all([
        loadProductsPage(0, OWNER_PRODUCTS_PAGE_SIZE, true),
        getCategories(true),
      ]);
    };

    run().catch(() => {});
  }, [user?.id, loading]);
};
