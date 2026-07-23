/**
 * Store settings mutations — primary DB writes and cache invalidation.
 */
import { cache, CacheKeys, CacheTTL } from '@/lib/cache';
import { enqueueCacheInvalidation } from '@/background/enqueue';
import { logger } from '@/lib/observability';
import { slugifyUsernameForStore, withStoreSlugSuffix } from '@/lib/storeSlug';
import {
  rpcPatchMerchantStoreSettings,
  rpcProvisionMerchantStore,
  storesTable,
  storeSettingsTable,
} from '@/repositories/store/storeRepository';
import { fetchStoreByUserId } from '@/services/read/store/storeReadService';
import { resolveStoreSlugByOwnerId } from '@/services/storefrontProductService';
import type { MerchantComplianceSettings } from '@/services/read/store/storeReadService';

export const upsertStoreSettings = async (
  ownerId: string,
  updates: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await rpcPatchMerchantStoreSettings({
    p_owner_id: ownerId,
    p_patch: updates,
  });

  if (error) {
    logger.error('store.settings.save_failed', {
      domain: 'store',
      errorCategory: 'database',
      merchantId: ownerId,
      status: 'error',
    }, error);
    return { success: false, error: error.message };
  }

  if (data?.success === false) {
    return { success: false, error: String(data?.error ?? 'patch_failed') };
  }

  if (data?.noop !== true) {
    cache.del(CacheKeys.storeSettings(ownerId));
    enqueueCacheInvalidation(ownerId, 'settings');
  }
  return { success: true };
};

export const invalidateStoreSettingsCache = (ownerId: string) => {
  cache.del(CacheKeys.storeSettings(ownerId));
  cache.del(CacheKeys.store(ownerId));
  cache.del(CacheKeys.ownerSlug(ownerId));
  enqueueCacheInvalidation(ownerId, 'settings');
};

async function isStoreSlugTaken(slug: string, excludeOwnerId: string): Promise<boolean> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return true;

  const { data: settingsRow } = await storeSettingsTable()
    .select('owner_id')
    .ilike('store_slug', normalized)
    .maybeSingle();
  if (settingsRow?.owner_id && settingsRow.owner_id !== excludeOwnerId) return true;

  const { data: storeRow } = await storesTable()
    .select('user_id')
    .ilike('store_slug', normalized)
    .maybeSingle();
  if (storeRow?.user_id && storeRow.user_id !== excludeOwnerId) return true;

  return false;
}

async function pickAvailableStoreSlug(seed: string, ownerId: string): Promise<string> {
  const base = slugifyUsernameForStore(seed);
  if (!(await isStoreSlugTaken(base, ownerId))) return base;

  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = withStoreSlugSuffix(base, suffix);
    if (!(await isStoreSlugTaken(candidate, ownerId))) return candidate;
  }

  return withStoreSlugSuffix(base, Number.parseInt(ownerId.replace(/-/g, '').slice(0, 4), 16) % 900 + 100);
}

function cacheResolvedSlug(ownerId: string, slug: string) {
  const normalized = slug.trim().toLowerCase();
  cache.set(CacheKeys.ownerSlug(ownerId), normalized, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
  cache.set(CacheKeys.slugOwner(normalized), ownerId, CacheTTL.STOREFRONT, CacheTTL.STOREFRONT_STALE);
}

/** Ensure every merchant has a persisted public slug — auto-provisions when missing. */
export async function ensureMerchantStoreSlug(
  ownerId: string,
  options?: { username?: string; storeName?: string }
): Promise<string | null> {
  if (!ownerId) return null;

  const existing = await resolveStoreSlugByOwnerId(ownerId);
  if (existing) return existing;

  const store = await fetchStoreByUserId(ownerId);
  const username = options?.username?.trim();
  const storeName = options?.storeName?.trim() || store?.storeName || 'متجري';
  const asciiUsername = username && /[a-z0-9]/i.test(username) ? username : '';
  const seed = asciiUsername || store?.storeSlug || `shop-${ownerId.replace(/-/g, '').slice(0, 8)}`;

  if (!store) {
    const { data, error } = await rpcProvisionMerchantStore({
      p_user_id: ownerId,
      p_username: username || undefined,
      p_store_name: storeName,
    });

    if (error) {
      logger.warn('store.slug.provision_failed', {
        domain: 'store',
        merchantId: ownerId,
        errorCategory: 'database',
      }, error);
    } else {
      const provisionedSlug = typeof data?.store_slug === 'string' ? data.store_slug.trim().toLowerCase() : '';
      if (provisionedSlug) {
        invalidateStoreSettingsCache(ownerId);
        cacheResolvedSlug(ownerId, provisionedSlug);
        return provisionedSlug;
      }
    }

    return resolveStoreSlugByOwnerId(ownerId);
  }

  const slug = await pickAvailableStoreSlug(seed, ownerId);
  const result = await upsertStoreSettings(ownerId, { store_slug: slug });
  if (!result.success) {
    logger.warn('store.slug.assign_failed', {
      domain: 'store',
      merchantId: ownerId,
      error: result.error,
    });
    return null;
  }

  try {
    await storesTable().update({ store_slug: slug }).eq('user_id', ownerId);
  } catch {
    /* stores table may not exist before migration */
  }

  invalidateStoreSettingsCache(ownerId);
  cacheResolvedSlug(ownerId, slug);
  return slug;
}

export const saveMerchantComplianceSettings = async (
  ownerId: string,
  settings: MerchantComplianceSettings
): Promise<{ success: boolean; error?: string }> => {
  const paymentMethods = [
    settings.paymentCashOnDelivery ? 'cash_on_delivery' : null,
    settings.paymentCreditCard ? 'credit_card' : null,
    settings.paymentEwallet ? 'digital_wallet' : null,
  ].filter(Boolean) as string[];

  const result = await upsertStoreSettings(ownerId, {
    store_slug: settings.storeSlug,
    return_policy: settings.returnPolicy || null,
    privacy_policy: settings.privacyPolicy || null,
    terms_conditions: settings.termsConditions || null,
    whatsapp_number: settings.whatsappNumber || null,
    whatsapp_welcome_message: settings.whatsappWelcomeMessage || null,
    whatsapp_order_confirmation: settings.whatsappOrderConfirmation || null,
    payment_methods: paymentMethods,
  });

  if (!result.success) return result;

  try {
    await storesTable().update({ store_slug: settings.storeSlug }).eq('user_id', ownerId);
  } catch {
    /* stores table may not exist before migration */
  }

  return { success: true };
};

export const saveCustomDomain = async (
  ownerId: string,
  domain: string
): Promise<{ success: boolean; error?: string; code?: string }> => {
  const { error } = await storeSettingsTable()
    .update({ custom_domain: domain, domain_verified: false })
    .eq('owner_id', ownerId);

  if (error) {
    return { success: false, error: error.message, code: error.code };
  }
  cache.del(CacheKeys.storeSettings(ownerId));
  return { success: true };
};

export const removeCustomDomain = async (
  ownerId: string
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await storeSettingsTable()
    .update({ custom_domain: null, domain_verified: false })
    .eq('owner_id', ownerId);

  if (error) return { success: false, error: error.message };
  cache.del(CacheKeys.storeSettings(ownerId));
  return { success: true };
};
