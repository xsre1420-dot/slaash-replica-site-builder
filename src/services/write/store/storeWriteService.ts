/**
 * Store settings mutations — primary DB writes and cache invalidation.
 */
import { cache, CacheKeys } from '@/lib/cache';
import { enqueueCacheInvalidation } from '@/background/enqueue';
import { rpcPatchMerchantStoreSettings, storesTable, storeSettingsTable } from '@/repositories/store/storeRepository';
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
    console.error('Error saving store settings:', error);
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
  enqueueCacheInvalidation(ownerId, 'settings');
};

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
