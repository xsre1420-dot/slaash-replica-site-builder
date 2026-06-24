import { Category } from '@/types';
import { cache, CacheTTL, dedup } from '@/lib/cache';
import { cacheGet, cacheSet } from '@/utils/indexedDB';
import { loadStorefrontBundle, resolveStoreOwnerBySlug } from '@/services/storefrontProductService';
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

function notify(slug: string) {
  getEntry(slug).listeners.forEach((l) => l());
}

function setSnapshot(slug: string, patch: Partial<TenantStoreSnapshot>) {
  const entry = getEntry(slug);
  entry.snapshot = { ...entry.snapshot, ...patch };
  notify(slug);
}

export function subscribeTenantStore(slug: string, listener: () => void): () => void {
  const entry = getEntry(slug);
  entry.listeners.add(listener);
  return () => entry.listeners.delete(listener);
}

export function getTenantStoreSnapshot(slug: string): TenantStoreSnapshot | null {
  return entries.get(slug)?.snapshot ?? null;
}

export async function fetchTenantStore(slug: string, force = false): Promise<void> {
  const entry = getEntry(slug);
  if (entry.inflight && !force) return entry.inflight;

  const cacheKey = `tenant-meta:${slug}`;
  const idbKey = `idb:${cacheKey}`;

  const task = (async () => {
    if (!force) {
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
      cache.set(cacheKey, data, CacheTTL.LONG, CacheTTL.MEDIUM);
      await cacheSet(idbKey, data);
      setSnapshot(slug, {
        storeInfo: data.storeInfo,
        categories: data.categories,
        loading: false,
        error: null,
      });
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
