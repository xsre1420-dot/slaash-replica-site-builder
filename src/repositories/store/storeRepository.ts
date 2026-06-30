import { supabase, callWriteRpc, callReadRpc, adaptRpcResult } from '@/repositories/base';

export function storeSettingsTable() {
  return supabase.from('store_settings');
}

export function storesTable() {
  return supabase.from('stores');
}

/** @consistency requires_primary */
export async function rpcGetStoreForUser(p_user_id: string) {
  return adaptRpcResult(await callReadRpc('get_store_for_user', { p_user_id }));
}

/** @consistency replica_safe */
export async function rpcGetOwnerBootstrap(p_user_id: string) {
  return adaptRpcResult(await callReadRpc('get_owner_bootstrap', { p_user_id }));
}

/** @consistency replica_safe */
export async function rpcListPublicStoreSlugs(p_limit: number, p_offset: number) {
  return adaptRpcResult(await callReadRpc('list_public_store_slugs', { p_limit, p_offset }));
}

export async function rpcPatchMerchantStoreSettings(args: Record<string, unknown>) {
  return callWriteRpc('patch_merchant_store_settings', args);
}

export async function rpcBumpStorefrontCacheVersion(p_owner_id: string) {
  return callWriteRpc<number>('bump_storefront_cache_version', { p_owner_id });
}

export async function selectStoreSlugForOwner(ownerId: string) {
  return supabase.from('store_settings').select('store_slug').eq('owner_id', ownerId).maybeSingle();
}

export async function selectStoreSlugFromStores(userId: string) {
  return storesTable().select('store_slug').eq('user_id', userId).maybeSingle();
}

export async function selectStoreSettingsByOwner(
  ownerId: string,
  columns: string
) {
  return storeSettingsTable().select(columns).eq('owner_id', ownerId).maybeSingle();
}

export async function selectStoreByUserId(userId: string) {
  return storesTable()
    .select('id, user_id, store_name, store_slug, theme_id')
    .eq('user_id', userId)
    .maybeSingle();
}

export async function selectStoreSettingsFallback(ownerId: string) {
  return storeSettingsTable()
    .select('id, owner_id, store_name, store_slug')
    .eq('owner_id', ownerId)
    .maybeSingle();
}

export async function selectCustomDomainSettings(ownerId: string) {
  return storeSettingsTable()
    .select('custom_domain, domain_verified')
    .eq('owner_id', ownerId)
    .maybeSingle();
}
