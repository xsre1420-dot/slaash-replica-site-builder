import React, { createContext, useContext, useSyncExternalStore, ReactNode, useCallback } from 'react';
import { Category, Product } from '@/types';
import {
  subscribeTenantStore,
  getTenantStoreSnapshot,
  fetchTenantStore,
  type TenantStoreInfo,
} from '@/lib/tenantStoreRegistry';

export interface TenantStoreData {
  storeInfo: TenantStoreInfo | null;
  /** @deprecated Use useStoreProductsPage for catalog */
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const TenantStoreContext = createContext<string | null>(null);

export function TenantStoreProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const normalized = slug.trim().toLowerCase();
  return (
    <TenantStoreContext.Provider value={normalized}>
      {children}
    </TenantStoreContext.Provider>
  );
}

function useTenantStoreFromRegistry(slug: string | undefined): TenantStoreData {
  const normalized = slug?.trim().toLowerCase();

  const snapshot = useSyncExternalStore(
    (onStoreChange) => (normalized ? subscribeTenantStore(normalized, onStoreChange) : () => {}),
    () => (normalized ? getTenantStoreSnapshot(normalized) : null),
    () => (normalized ? getTenantStoreSnapshot(normalized) : null)
  );

  const refetch = useCallback(() => {
    if (normalized) void fetchTenantStore(normalized, true);
  }, [normalized]);

  if (!normalized || !/^[a-z0-9-]+$/.test(normalized)) {
    return {
      storeInfo: null,
      products: [],
      categories: [],
      loading: false,
      error: 'رابط المتجر غير صالح',
      refetch: () => {},
    };
  }

  if (!snapshot) {
    void fetchTenantStore(normalized);
    return {
      storeInfo: null,
      products: [],
      categories: [],
      loading: true,
      error: null,
      refetch,
    };
  }

  return {
    storeInfo: snapshot.storeInfo,
    products: [],
    categories: snapshot.categories,
    loading: snapshot.loading,
    error: snapshot.error,
    refetch,
  };
}

export function useTenantStore(slug?: string): TenantStoreData {
  const contextSlug = useContext(TenantStoreContext);
  const effectiveSlug = slug ?? contextSlug ?? undefined;
  return useTenantStoreFromRegistry(effectiveSlug);
}
