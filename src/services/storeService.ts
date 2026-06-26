/**
 * Legacy store service facade — read/write separation with backward-compatible exports.
 */
export {
  mapStoreSettingsRow,
  fetchStoreSettings,
  fetchStoreByUserId,
  bootstrapOwnerStore,
  defaultStoreSettings,
  type StoreSettings,
  mapMerchantComplianceSettings,
  fetchMerchantComplianceSettings,
  type MerchantComplianceSettings,
  fetchCustomDomainSettings,
  type CustomDomainSettings,
  type StoreRecord,
  type BootstrapResult,
  type PublicStoreSlug,
  listPublicStoreSlugs,
} from '@/services/read/store/storeReadService';

export {
  upsertStoreSettings,
  invalidateStoreSettingsCache,
  saveMerchantComplianceSettings,
  saveCustomDomain,
  removeCustomDomain,
} from '@/services/write/store/storeWriteService';
