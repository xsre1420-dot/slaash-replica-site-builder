import { supabase } from '@/integrations/supabase/client';
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';

export interface StoreMarketingConfig {
  ownerId: string;
  marketingEnabled: boolean;
  metaPixelId: string | null;
  googleAnalyticsId: string | null;
}

const VALID_PIXEL_ID = /^[0-9]+$/;
const VALID_GA_ID = /^(G-[A-Z0-9]+|UA-[0-9]+-[0-9]+)$/i;

function normalizeConfig(raw: Record<string, unknown> | null): StoreMarketingConfig | null {
  if (!raw?.owner_id) return null;

  const metaRaw = String(raw.meta_pixel_id || '').trim();
  const gaRaw = String(raw.google_analytics_id || '').trim();

  return {
    ownerId: String(raw.owner_id),
    marketingEnabled: Boolean(raw.marketing_enabled),
    metaPixelId: metaRaw && VALID_PIXEL_ID.test(metaRaw) ? metaRaw : null,
    googleAnalyticsId: gaRaw && VALID_GA_ID.test(gaRaw) ? gaRaw : null,
  };
}

export async function fetchStoreMarketingBySlug(slug: string): Promise<StoreMarketingConfig | null> {
  const normalized = slug.trim().toLowerCase();
  const cacheKey = CacheKeys.tenantMeta(`marketing:${normalized}`);
  const cached = cache.get<StoreMarketingConfig>(cacheKey);
  if (cached) return cached;

  const { data, error } = await (supabase as any).rpc('get_store_marketing_public', {
    p_slug: normalized,
  });

  if (error || !data) return null;
  const config = normalizeConfig(data as Record<string, unknown>);
  if (config) {
    cache.set(cacheKey, config, CacheTTL.MEDIUM, CacheTTL.SHORT);
  }
  return config;
}

export async function fetchStoreMarketingByOwner(ownerId: string): Promise<StoreMarketingConfig | null> {
  const cacheKey = `marketing:owner:${ownerId}`;
  const cached = cache.get<StoreMarketingConfig>(cacheKey);
  if (cached) return cached;

  const { data, error } = await (supabase as any).rpc('get_store_marketing_for_owner', {
    p_owner_id: ownerId,
  });

  if (error || !data) return null;
  const config = normalizeConfig(data as Record<string, unknown>);
  if (config) {
    cache.set(cacheKey, config, CacheTTL.MEDIUM, CacheTTL.SHORT);
  }
  return config;
}

export async function fetchStoreMarketingConfig(opts: {
  storeSlug?: string | null;
  ownerId?: string | null;
}): Promise<StoreMarketingConfig | null> {
  if (opts.storeSlug?.trim()) {
    return fetchStoreMarketingBySlug(opts.storeSlug);
  }
  if (opts.ownerId) {
    return fetchStoreMarketingByOwner(opts.ownerId);
  }
  return null;
}

export function invalidateStoreMarketingCache(storeSlug?: string, ownerId?: string): void {
  if (storeSlug?.trim()) {
    cache.del(CacheKeys.tenantMeta(`marketing:${storeSlug.trim().toLowerCase()}`));
  }
  if (ownerId) {
    cache.del(`marketing:owner:${ownerId}`);
  }
}
