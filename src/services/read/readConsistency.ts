/**
 * Read service consistency declarations — consumed by audits and routing registry.
 */
import type { ReadConsistency } from '@/lib/readWrite/readConsistencyRegistry';

export type ServiceReadProfile = {
  service: string;
  defaultConsistency: ReadConsistency;
  notes: string;
};

export const ORDER_READ_PROFILE: ServiceReadProfile = {
  service: 'orderReadService',
  defaultConsistency: 'replica_safe',
  notes: 'Historical orders and workflow counts; checkout writes stay on primary via orderWriteService.',
};

export const STORE_READ_PROFILE: ServiceReadProfile = {
  service: 'storeReadService',
  defaultConsistency: 'requires_primary',
  notes: 'Session store resolution requires primary; bootstrap/slugs replica-safe via repository.',
};

export const PRODUCT_READ_PROFILE: ServiceReadProfile = {
  service: 'productQueryService',
  defaultConsistency: 'replica_safe',
  notes: 'Merchant catalog reads; PostgREST table queries remain primary until replica client.',
};

export const DASHBOARD_READ_PROFILE: ServiceReadProfile = {
  service: 'dashboardStatsService',
  defaultConsistency: 'replica_safe',
  notes: 'Statistics, KPIs, and reports — L1 cache then replica when configured.',
};

export const STOREFRONT_READ_PROFILE: ServiceReadProfile = {
  service: 'storefrontQueryService',
  defaultConsistency: 'eventually_consistent',
  notes: 'Public storefront pages — edge cache then regional/local replica.',
};

export const INVENTORY_READ_PROFILE: ServiceReadProfile = {
  service: 'inventoryReadService',
  defaultConsistency: 'replica_safe',
  notes: 'Movement history; live integrity audits require primary.',
};

export const COUPON_READ_PROFILE: ServiceReadProfile = {
  service: 'couponReadService',
  defaultConsistency: 'requires_primary',
  notes: 'Checkout coupon validation requires primary; merchant list replica-safe.',
};

export const READ_SERVICE_PROFILES: ServiceReadProfile[] = [
  ORDER_READ_PROFILE,
  STORE_READ_PROFILE,
  PRODUCT_READ_PROFILE,
  DASHBOARD_READ_PROFILE,
  STOREFRONT_READ_PROFILE,
  INVENTORY_READ_PROFILE,
  COUPON_READ_PROFILE,
];
