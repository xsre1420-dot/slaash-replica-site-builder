import React, {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Category, Product } from '@/types';
import {
  subscribeTenantStore,
  peekTenantStoreSnapshot,
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
const SLUG_RE = /^[a-z0-9-]+$/;

export function TenantStoreProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const normalized = slug.trim().toLowerCase();

  useEffect(() => {
    if (!SLUG_RE.test(normalized)) return;
    void fetchTenantStore(normalized);
  }, [normalized]);

  return (
    <TenantStoreContext.Provider value={normalized}>
      {children}
    </TenantStoreContext.Provider>
  );
}

function useTenantStoreFromRegistry(slug: string | undefined): TenantStoreData {
  const normalized = slug?.trim().toLowerCase();
  const isValidSlug = !!normalized && SLUG_RE.test(normalized);

  const [snapshot, setSnapshot] = useState(() =>
    isValidSlug ? peekTenantStoreSnapshot(normalized!) : null
  );

  useEffect(() => {
    if (!isValidSlug) return;
    setSnapshot(peekTenantStoreSnapshot(normalized!));
    return subscribeTenantStore(normalized!, () => {
      setSnapshot(peekTenantStoreSnapshot(normalized!));
    });
  }, [isValidSlug, normalized]);

  const refetch = useCallback(() => {
    if (isValidSlug) void fetchTenantStore(normalized!, true);
  }, [isValidSlug, normalized]);

  if (!isValidSlug) {
    return {
      storeInfo: null,
      products: [],
      categories: [],
      loading: false,
      error: 'رابط المتجر غير صالح',
      refetch: () => {},
    };
  }

  return {
    storeInfo: snapshot!.storeInfo,
    products: [],
    categories: snapshot!.categories,
    loading: snapshot!.loading,
    error: snapshot!.error,
    refetch,
  };
}

export function useTenantStore(slug?: string): TenantStoreData {
  const contextSlug = useContext(TenantStoreContext);
  const effectiveSlug = slug ?? contextSlug ?? undefined;
  return useTenantStoreFromRegistry(effectiveSlug);
}
