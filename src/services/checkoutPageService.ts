/**
 * Checkout page bundle — store init + cart product validation in one coordinated load.
 */
import { Product } from '@/types';
import { cache, CacheKeys, CacheTTL, dedup, clearInflight } from '@/lib/cache';
import { DeliveryPrice } from '@/utils/deliveryUtils';
import {
  loadCheckoutInitBundle,
  type CheckoutInitBundle,
} from '@/lib/tenantStoreRegistry';
import {
  fetchCheckoutProductsByIds,
  resolveStoreSlugByOwnerId,
} from '@/services/storefrontProductService';
import {
  bootstrapOwnerStore,
  fetchStoreSettings,
  mapStoreSettingsRow,
} from '@/services/storeService';
import { fetchFreshProducts } from '@/utils/checkoutValidation';

export type CheckoutPageInit = {
  ownerId: string;
  storeName: string;
  storeSlug: string | null;
  storeLogo: string;
  deliveryPrices: DeliveryPrice[];
  paymentMethods: unknown;
  whatsappNumber: string;
  menuBackgroundColor: string;
  menuTextColor: string;
  menuAccentColor: string;
  storeFont: string;
};

export type CheckoutPageBundle = {
  init: CheckoutPageInit;
  freshProducts: Map<string, Product>;
};

const initFromCheckoutBundle = (
  init: CheckoutInitBundle,
  theme?: Partial<CheckoutPageInit>
): CheckoutPageInit => ({
  ownerId: init.ownerId,
  storeName: init.storeName,
  storeSlug: init.storeSlug,
  storeLogo: theme?.storeLogo ?? '',
  deliveryPrices: init.deliveryPrices,
  paymentMethods: init.paymentMethods,
  whatsappNumber: init.whatsappNumber,
  menuBackgroundColor: theme?.menuBackgroundColor ?? '#ffffff',
  menuTextColor: theme?.menuTextColor ?? '#333333',
  menuAccentColor: theme?.menuAccentColor ?? '#6366f1',
  storeFont: theme?.storeFont ?? 'Tajawal',
});

async function loadMerchantCheckoutInit(ownerId: string): Promise<CheckoutPageInit> {
  if (!cache.has(CacheKeys.storeSettings(ownerId))) {
    await bootstrapOwnerStore(ownerId);
  }

  let settingsRow = cache.get<Record<string, unknown>>(CacheKeys.storeSettings(ownerId));
  if (!settingsRow) {
    await fetchStoreSettings(ownerId);
    settingsRow = cache.get<Record<string, unknown>>(CacheKeys.storeSettings(ownerId));
  }

  const profile = settingsRow ? mapStoreSettingsRow(settingsRow) : null;
  const storeSlug = await resolveStoreSlugByOwnerId(ownerId);

  return {
    ownerId,
    storeName: profile?.storeName ?? '',
    storeSlug,
    storeLogo: profile?.storeLogo ?? '',
    deliveryPrices: profile?.settings.deliveryPrices ?? [],
    paymentMethods: profile?.settings.paymentMethods ?? ['cash_on_delivery'],
    whatsappNumber: String(settingsRow?.whatsapp_number ?? ''),
    menuBackgroundColor: profile?.settings.menuBackgroundColor ?? '#ffffff',
    menuTextColor: profile?.settings.menuTextColor ?? '#333333',
    menuAccentColor: profile?.settings.menuAccentColor ?? '#6366f1',
    storeFont: profile?.settings.storeFont ?? 'Tajawal',
  };
}

function scopeKey(params: { storeSlug?: string; ownerId?: string; cartKey: string }): string | null {
  if (params.storeSlug?.trim()) {
    return `s:${params.storeSlug.trim().toLowerCase()}:${params.cartKey}`;
  }
  if (params.ownerId?.trim()) {
    return `o:${params.ownerId.trim()}:${params.cartKey}`;
  }
  return null;
}

export function peekCheckoutPageBundle(params: {
  storeSlug?: string;
  ownerId?: string;
  cartKey: string;
}): CheckoutPageBundle | null {
  const scope = scopeKey(params);
  if (!scope) return null;
  return cache.get<CheckoutPageBundle>(CacheKeys.checkoutPage(scope, params.cartKey));
}

export function invalidateCheckoutPageBundle(scope?: { storeSlug?: string; ownerId?: string }): void {
  if (scope?.storeSlug) {
    cache.flushByPrefix(`checkout-page:s:${scope.storeSlug.trim().toLowerCase()}:`);
    return;
  }
  if (scope?.ownerId) {
    cache.flushByPrefix(`checkout-page:o:${scope.ownerId}:`);
    return;
  }
  cache.flushByPrefix('checkout-page:');
}

/** Single deduped checkout entry: store settings + fresh cart products. */
export async function loadCheckoutPageBundle(params: {
  storeSlug?: string;
  ownerId?: string;
  productIds: string[];
  cartKey: string;
  cartFallback?: Map<string, Product>;
  force?: boolean;
}): Promise<CheckoutPageBundle | null> {
  const { productIds, cartKey, cartFallback, force } = params;
  const scope = scopeKey({ ...params, cartKey });
  if (!scope) return null;

  const cacheKey = CacheKeys.checkoutPage(scope, cartKey);

  if (!force) {
    const peek = peekCheckoutPageBundle(params);
    if (peek) return peek;
  } else {
    cache.del(cacheKey);
    clearInflight(cacheKey);
  }

  return dedup(cacheKey, async () => {
    const uniqueIds = [...new Set(productIds.filter(Boolean))];

    if (params.storeSlug) {
      const slug = params.storeSlug.trim().toLowerCase();
      const [init, freshProducts] = await Promise.all([
        loadCheckoutInitBundle(slug),
        uniqueIds.length > 0
          ? fetchCheckoutProductsByIds(slug, uniqueIds)
          : Promise.resolve(new Map<string, Product>()),
      ]);

      if (!init) return null;

      const bundle: CheckoutPageBundle = {
        init: initFromCheckoutBundle(init),
        freshProducts,
      };
      cache.set(cacheKey, bundle, CacheTTL.SHORT, CacheTTL.STALE);
      return bundle;
    }

    const ownerId = params.ownerId?.trim();
    if (!ownerId) return null;

    const init = await loadMerchantCheckoutInit(ownerId);
    const freshProducts =
      uniqueIds.length > 0
        ? await fetchFreshProducts(ownerId, uniqueIds, init.storeSlug ?? undefined, {
            cartFallback,
          })
        : new Map<string, Product>();

    const bundle: CheckoutPageBundle = { init, freshProducts };
    cache.set(cacheKey, bundle, CacheTTL.SHORT, CacheTTL.STALE);
    return bundle;
  });
}
