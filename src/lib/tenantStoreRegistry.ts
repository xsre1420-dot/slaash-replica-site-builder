import { Category } from '@/types';
import { cache, CacheKeys, CacheTTL, dedup } from '@/lib/cache';
import { cacheSet, cacheDeleteByPrefix } from '@/utils/indexedDB';
import {
  ensureStorefrontPageBundle,
  peekStorefrontBundle,
  resolveStoreOwnerBySlug,
  fetchStorePolicies,
  STOREFRONT_PRODUCTS_CHANGED,
} from '@/services/storefrontProductService';
import { StorefrontCacheKeys } from '@/services/storefrontCacheService';
import { awaitStorefrontBundleReady } from '@/lib/storefront/storefrontLoadCoordinator';
import { getTenantStoreInflight, setTenantStoreInflight } from '@/lib/tenantStoreInflight';

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

async function fetchTenantMetaFromBundle(normalizedSlug: string) {
  const bundle =
    peekStorefrontBundle(normalizedSlug) ??
    (await ensureStorefrontPageBundle(normalizedSlug));
  if (!bundle?.store) {
    throw new Error('المتجر غير موجود');
  }

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

export type CheckoutInitBundle = {
  ownerId: string;
  storeName: string;
  storeSlug: string;
  deliveryPrices: TenantStoreInfo['deliveryPrices'];
  paymentMethods: unknown;
  whatsappNumber: string;
};

/** Sync checkout init from tenant registry — no network when storefront bundle is warm. */
export function peekCheckoutInitBundle(slug: string): CheckoutInitBundle | null {
  const normalized = slug.trim().toLowerCase();
  const cached = cache.get<CheckoutInitBundle>(CacheKeys.checkoutInit(normalized));
  if (cached?.ownerId) return cached;

  const snapshot = getTenantStoreSnapshot(normalized);
  const info = snapshot?.storeInfo;
  if (!info?.ownerId) return null;

  const bundle: CheckoutInitBundle = {
    ownerId: info.ownerId,
    storeName: info.storeName,
    storeSlug: info.storeSlug,
    deliveryPrices: info.deliveryPrices,
    paymentMethods: info.paymentMethods,
    whatsappNumber: info.whatsappNumber,
  };
  cache.set(CacheKeys.checkoutInit(normalized), bundle, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
  return bundle;
}

/** Ensures tenant meta is hydrated, then returns checkout initialization data. */
export async function loadCheckoutInitBundle(slug: string): Promise<CheckoutInitBundle | null> {
  const normalized = slug.trim().toLowerCase();
  const peek = peekCheckoutInitBundle(normalized);
  if (peek) return peek;

  await fetchTenantStore(normalized);
  return peekCheckoutInitBundle(normalized);
}

/** Ensures a registry entry exists; used by useSyncExternalStore getSnapshot. */
export function peekTenantStoreSnapshot(slug: string): TenantStoreSnapshot {
  return getEntry(slug).snapshot;
}

async function hydrateSnapshotFromBundlePeek(slug: string): Promise<boolean> {
  const bundlePeek = peekStorefrontBundle(slug);
  if (!bundlePeek?.store) return false;

  let ownerId = String(bundlePeek.store.owner_id || '');
  if (!ownerId) {
    ownerId = (await resolveStoreOwnerBySlug(slug)) || '';
  }
  if (!ownerId) return false;

  const cacheKey = StorefrontCacheKeys.meta(slug);
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
  return true;
}

export function invalidateTenantStore(slug: string): void {
  const normalized = slug.trim().toLowerCase();
  cache.del(StorefrontCacheKeys.meta(normalized));
  cache.del(CacheKeys.checkoutInit(normalized));
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
      if (await hydrateSnapshotFromBundlePeek(slug)) return;

      await awaitStorefrontBundleReady(slug);
      if (await hydrateSnapshotFromBundlePeek(slug)) return;
    }

    setSnapshot(slug, { loading: true, error: null });

    try {
      await awaitStorefrontBundleReady(slug);
      if (!force && (await hydrateSnapshotFromBundlePeek(slug))) return;

      const cacheKey = StorefrontCacheKeys.meta(slug);
      const idbKey = `idb:${cacheKey}`;
      const data = await dedup(cacheKey, () => fetchTenantMetaFromBundle(slug));
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
  setTenantStoreInflight(slug, task);
  try {
    await task;
  } finally {
    if (entry.inflight === task) {
      entry.inflight = null;
      setTenantStoreInflight(slug, null);
    }
  }
}
