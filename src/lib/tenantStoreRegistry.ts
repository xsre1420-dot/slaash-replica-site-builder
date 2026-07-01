import { Category } from '@/types';
import { cache, CacheTTL, dedup } from '@/lib/cache';
import { cacheGet, cacheSet, cacheDeleteByPrefix } from '@/utils/indexedDB';
import {
  loadStorefrontBundle,
  peekStorefrontBundle,
  resolveStoreOwnerBySlug,
  fetchStorePolicies,
  STOREFRONT_PRODUCTS_CHANGED,
} from '@/services/storefrontProductService';
import { StorefrontCacheKeys } from '@/services/storefrontCacheService';
import { supabase } from '@/integrations/supabase/client';

const META_IDB_TTL = 10 * 60 * 1000;

export interface TenantStoreInfo {
  ownerId: string;
  storeName: string;
  storeLogo: string;
  storeSlug: string;
  menuBackgroundColor: string;
  menuTextColor: string;
  menuAccentColor: string;
  storeFont: string;
  bannerImages: string[];
  primaryBannerIndex: number;
  deliveryPrices: { governorate: string; price: number }[];
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  returnPolicy: string;
  privacyPolicy: string;
  paymentMethods: unknown;
}

export interface TenantStoreSnapshot {
  storeInfo: TenantStoreInfo | null;
  categories: Category[];
  loading: boolean;
  error: string | null;
}

type SlugEntry = {
  snapshot: TenantStoreSnapshot;
  listeners: Set<() => void>;
  inflight: Promise<void> | null;
};

const entries = new Map<string, SlugEntry>();

const emptySnapshot = (): TenantStoreSnapshot => ({
  storeInfo: null,
  categories: [],
  loading: true,
  error: null,
});

const buildStoreInfo = (
  store: Record<string, unknown>,
  normalizedSlug: string,
  ownerId: string
): TenantStoreInfo => ({
  ownerId,
  storeName: String(store.store_name || ''),
  storeLogo: String(store.store_logo || ''),
  storeSlug: String(store.store_slug || normalizedSlug),
  menuBackgroundColor: String(store.menu_background_color || '#ffffff'),
  menuTextColor: String(store.menu_text_color || '#333333'),
  menuAccentColor: String(store.menu_accent_color || '#6366f1'),
  storeFont: String(store.store_font || 'Tajawal'),
  bannerImages: (store.banner_images as string[]) || [],
  primaryBannerIndex: Number(store.primary_banner_index) || 0,
  deliveryPrices: (store.delivery_prices as { governorate: string; price: number }[]) || [],
  whatsappNumber: String(store.whatsapp_number || ''),
  facebookUrl: String(store.facebook_url || ''),
  instagramUrl: String(store.instagram_url || ''),
  returnPolicy: String(store.return_policy || ''),
  privacyPolicy: String(store.privacy_policy || ''),
  paymentMethods: store.payment_methods,
});

async function hydrateStorePolicies(slug: string, storeInfo: TenantStoreInfo): Promise<TenantStoreInfo> {
  if (storeInfo.returnPolicy || storeInfo.privacyPolicy) return storeInfo;
  const policies = await fetchStorePolicies(slug);
  return {
    ...storeInfo,
    returnPolicy: policies.returnPolicy || storeInfo.returnPolicy,
    privacyPolicy: policies.privacyPolicy || storeInfo.privacyPolicy,
  };
}

function schedulePolicyHydration(slug: string, storeInfo: TenantStoreInfo) {
  if (storeInfo.returnPolicy || storeInfo.privacyPolicy) return;
  void hydrateStorePolicies(slug, storeInfo).then((enriched) => {
    if (!enriched.returnPolicy && !enriched.privacyPolicy) return;
    const entry = entries.get(slug);
    if (!entry?.snapshot.storeInfo) return;
    setSnapshot(slug, {
      storeInfo: { ...entry.snapshot.storeInfo!, ...enriched },
    });
  });
}

async function fetchStoreMeta(normalizedSlug: string) {
  const bundle = await loadStorefrontBundle(normalizedSlug);
  if (bundle?.store) {
    const store = bundle.store;
    let ownerId = String(store.owner_id || '');
    if (!ownerId) {
      ownerId = (await resolveStoreOwnerBySlug(normalizedSlug)) || '';
    }
    if (!ownerId) throw new Error('المتجر غير صالح');
    return {
      storeInfo: buildStoreInfo({ ...store, owner_id: ownerId }, normalizedSlug, ownerId),
      categories: (bundle.categories || []).map((c) => ({
        id: String(c.id),
        name: String(c.name),
        order: Number(c.display_order) || 0,
      })),
    };
  }

  const { data: meta, error: metaErr } = await (supabase as any).rpc('get_store_meta', {
    p_slug: normalizedSlug,
  });

  if (!metaErr && meta?.store) {
    const store = meta.store as Record<string, unknown>;
    let ownerId = String(store.owner_id || '');
    if (!ownerId) {
      ownerId = (await resolveStoreOwnerBySlug(normalizedSlug)) || '';
    }
    if (!ownerId) throw new Error('المتجر غير صالح');

    return {
      storeInfo: buildStoreInfo(store, normalizedSlug, ownerId),
      categories: ((meta.categories || []) as Record<string, unknown>[]).map((c) => ({
        id: String(c.id),
        name: String(c.name),
        order: Number(c.display_order) || 0,
      })),
    };
  }

  throw new Error(metaErr?.message || 'المتجر غير موجود');
}

function getEntry(slug: string): SlugEntry {
  let entry = entries.get(slug);
  if (!entry) {
    entry = { snapshot: emptySnapshot(), listeners: new Set(), inflight: null };
    entries.set(slug, entry);
  }
  return entry;
}

const pendingNotifySlugs = new Set<string>();

function notify(slug: string) {
  if (pendingNotifySlugs.has(slug)) return;
  pendingNotifySlugs.add(slug);
  setTimeout(() => {
    pendingNotifySlugs.delete(slug);
    getEntry(slug).listeners.forEach((l) => l());
  }, 0);
}

function setSnapshot(slug: string, patch: Partial<TenantStoreSnapshot>) {
  const entry = getEntry(slug);
  const next = { ...entry.snapshot, ...patch };
  if (
    entry.snapshot.storeInfo === next.storeInfo &&
    entry.snapshot.categories === next.categories &&
    entry.snapshot.loading === next.loading &&
    entry.snapshot.error === next.error
  ) {
    return;
  }
  entry.snapshot = next;
  notify(slug);
}

export function subscribeTenantStore(slug: string, listener: () => void): () => void {
  const entry = getEntry(slug);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0 && !entry.inflight) {
      entries.delete(slug);
    }
  };
}

export function getTenantStoreSnapshot(slug: string): TenantStoreSnapshot | null {
  return entries.get(slug)?.snapshot ?? null;
}

/** Ensures a registry entry exists; used by useSyncExternalStore getSnapshot. */
export function peekTenantStoreSnapshot(slug: string): TenantStoreSnapshot {
  return getEntry(slug).snapshot;
}

export function invalidateTenantStore(slug: string): void {
  const normalized = slug.trim().toLowerCase();
  cache.del(StorefrontCacheKeys.meta(normalized));
  void cacheDeleteByPrefix(`idb:${StorefrontCacheKeys.meta(normalized)}`);
  setSnapshot(normalized, { loading: true, error: null });
  void fetchTenantStore(normalized, true);
}

if (typeof window !== 'undefined') {
  window.addEventListener(STOREFRONT_PRODUCTS_CHANGED, ((event: CustomEvent<{ slug?: string; scope?: string }>) => {
    const slug = event.detail?.slug?.trim().toLowerCase();
    const scope = event.detail?.scope;
    if (!slug) return;
    if (scope === 'products' || scope === 'product') return;
    invalidateTenantStore(slug);
  }) as EventListener);

  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key !== 'storefront:invalidate' || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as { slug?: string; scope?: string };
      const slug = payload.slug?.trim().toLowerCase();
      if (!slug) return;
      if (payload.scope === 'products' || payload.scope === 'product') return;
      invalidateTenantStore(slug);
    } catch {
      /* ignore malformed payload */
    }
  });
}

export async function fetchTenantStore(slug: string, force = false): Promise<void> {
  const entry = getEntry(slug);
  if (entry.inflight && !force) return entry.inflight;

  const cacheKey = StorefrontCacheKeys.meta(slug);
  const idbKey = `idb:${cacheKey}`;

  const task = (async () => {
    if (!force) {
      const bundlePeek = peekStorefrontBundle(slug);
      if (bundlePeek?.store) {
        let ownerId = String(bundlePeek.store.owner_id || '');
        if (!ownerId) {
          ownerId = (await resolveStoreOwnerBySlug(slug)) || '';
        }
        if (ownerId) {
          const fromBundle = {
            storeInfo: buildStoreInfo({ ...bundlePeek.store, owner_id: ownerId }, slug, ownerId),
            categories: (bundlePeek.categories || []).map((c) => ({
              id: String(c.id),
              name: String(c.name),
              order: Number(c.display_order) || 0,
            })),
          };
          cache.set(cacheKey, fromBundle, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
          setSnapshot(slug, {
            storeInfo: fromBundle.storeInfo,
            categories: fromBundle.categories,
            loading: false,
            error: null,
          });
          schedulePolicyHydration(slug, fromBundle.storeInfo);
          return;
        }
      }

      const idbCached = await cacheGet<{ storeInfo: TenantStoreInfo; categories: Category[] }>(
        idbKey,
        META_IDB_TTL
      );
      if (idbCached) {
        setSnapshot(slug, {
          storeInfo: idbCached.storeInfo,
          categories: idbCached.categories,
          loading: false,
          error: null,
        });
        return;
      }

      const memCached = cache.get<{ storeInfo: TenantStoreInfo; categories: Category[] }>(cacheKey);
      if (memCached) {
        setSnapshot(slug, {
          storeInfo: memCached.storeInfo,
          categories: memCached.categories,
          loading: false,
          error: null,
        });
        return;
      }
    }

    setSnapshot(slug, { loading: true, error: null });

    try {
      const data = await dedup(cacheKey, () => fetchStoreMeta(slug));
      cache.set(cacheKey, data, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
      await cacheSet(idbKey, data);
      setSnapshot(slug, {
        storeInfo: data.storeInfo,
        categories: data.categories,
        loading: false,
        error: null,
      });
      schedulePolicyHydration(slug, data.storeInfo);
    } catch (err: unknown) {
      setSnapshot(slug, {
        loading: false,
        error: err instanceof Error ? err.message : 'فشل في تحميل المتجر',
      });
    }
  })();

  entry.inflight = task;
  try {
    await task;
  } finally {
    if (entry.inflight === task) entry.inflight = null;
  }
}
