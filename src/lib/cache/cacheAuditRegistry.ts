/**
 * Phase 1 — Cache audit registry.
 * Classifies every cached read path by TTL tier and cache layer responsibility.
 */
export type CacheTier = 'never' | 'short' | 'medium' | 'long' | 'static';

export type CacheLayer =
  | 'browser'
  | 'application_l1'
  | 'application_l2_redis'
  | 'edge'
  | 'cdn'
  | 'database_rollup';

export type CacheAuditEntry = {
  id: string;
  keyPattern: string;
  tier: CacheTier;
  primaryLayer: CacheLayer;
  fallbackLayers: CacheLayer[];
  domain: string;
  description: string;
  neverCacheReason?: string;
};

export const CACHE_AUDIT_REGISTRY: CacheAuditEntry[] = [
  // --- Never cache (critical / strong consistency) ---
  {
    id: 'checkout.preflight',
    keyPattern: 'checkout:*',
    tier: 'never',
    primaryLayer: 'application_l1',
    fallbackLayers: [],
    domain: 'checkout',
    description: 'Checkout preflight bundle — stock/pricing must be fresh',
    neverCacheReason: 'Strong consistency at checkout',
  },
  {
    id: 'checkout.cart_products',
    keyPattern: 'checkout:products:*',
    tier: 'never',
    primaryLayer: 'application_l1',
    fallbackLayers: [],
    domain: 'checkout',
    description: 'Cart product validation',
    neverCacheReason: 'Inventory deduction dependency',
  },
  {
    id: 'auth.session',
    keyPattern: 'auth:*',
    tier: 'never',
    primaryLayer: 'application_l1',
    fallbackLayers: [],
    domain: 'auth',
    description: 'Auth tokens and session state',
    neverCacheReason: 'Security',
  },
  {
    id: 'payment.verification',
    keyPattern: 'payment:*',
    tier: 'never',
    primaryLayer: 'application_l1',
    fallbackLayers: [],
    domain: 'payment',
    description: 'Payment status verification',
    neverCacheReason: 'Financial accuracy',
  },

  // --- Storefront (long + static via edge/CDN) ---
  {
    id: 'storefront.bundle',
    keyPattern: 'storefront-bundle:{slug}',
    tier: 'long',
    primaryLayer: 'edge',
    fallbackLayers: ['application_l1', 'application_l2_redis', 'browser'],
    domain: 'storefront',
    description: 'Homepage bundle — meta + first product page',
  },
  {
    id: 'storefront.products_page',
    keyPattern: 'storefront-page:{slug}:*',
    tier: 'long',
    primaryLayer: 'edge',
    fallbackLayers: ['application_l1', 'browser'],
    domain: 'storefront',
    description: 'Categories / product listing pages',
  },
  {
    id: 'storefront.product_detail',
    keyPattern: 'storefront-product:{slug}:{id}',
    tier: 'medium',
    primaryLayer: 'application_l1',
    fallbackLayers: ['application_l2_redis', 'browser'],
    domain: 'storefront',
    description: 'Product detail pages',
  },
  {
    id: 'storefront.meta',
    keyPattern: 'tenant-meta:{slug}',
    tier: 'long',
    primaryLayer: 'application_l1',
    fallbackLayers: ['edge', 'browser'],
    domain: 'storefront',
    description: 'Store settings / branding public meta',
  },
  {
    id: 'storefront.policies',
    keyPattern: 'storefront-policies:{slug}',
    tier: 'static',
    primaryLayer: 'application_l1',
    fallbackLayers: ['cdn', 'browser'],
    domain: 'storefront',
    description: 'Return / privacy policies',
  },
  {
    id: 'storefront.recommendations',
    keyPattern: 'footer-suggested:{slug}',
    tier: 'medium',
    primaryLayer: 'application_l1',
    fallbackLayers: ['application_l2_redis'],
    domain: 'storefront',
    description: 'Footer / suggested products',
  },
  {
    id: 'storefront.version',
    keyPattern: 'storefront-version:{slug}',
    tier: 'long',
    primaryLayer: 'application_l1',
    fallbackLayers: ['edge'],
    domain: 'storefront',
    description: 'Cache version key for CDN busting',
  },

  // --- Dashboard / analytics ---
  {
    id: 'dashboard.batch',
    keyPattern: 'dashboard-batch:{ownerId}',
    tier: 'medium',
    primaryLayer: 'application_l1',
    fallbackLayers: ['application_l2_redis', 'database_rollup'],
    domain: 'dashboard',
    description: 'Dashboard KPI statistics batch',
  },
  {
    id: 'dashboard.kpis_light',
    keyPattern: 'dashboard-kpis:{ownerId}',
    tier: 'medium',
    primaryLayer: 'application_l1',
    fallbackLayers: ['application_l2_redis'],
    domain: 'dashboard',
    description: 'Light dashboard KPIs',
  },
  {
    id: 'dashboard.workflow_counts',
    keyPattern: 'dashboard-workflow:{ownerId}',
    tier: 'short',
    primaryLayer: 'application_l1',
    fallbackLayers: ['application_l2_redis'],
    domain: 'dashboard',
    description: 'Order workflow tab counts',
  },
  {
    id: 'statistics.page',
    keyPattern: 'stats:{ownerId}:*',
    tier: 'medium',
    primaryLayer: 'application_l1',
    fallbackLayers: ['database_rollup'],
    domain: 'analytics',
    description: 'Statistics / reports page data',
  },

  // --- Merchant catalog ---
  {
    id: 'merchant.products',
    keyPattern: 'products:{ownerId}',
    tier: 'short',
    primaryLayer: 'application_l1',
    fallbackLayers: [],
    domain: 'merchant',
    description: 'Merchant product catalog list',
  },
  {
    id: 'merchant.categories',
    keyPattern: 'categories:{ownerId}',
    tier: 'short',
    primaryLayer: 'application_l1',
    fallbackLayers: [],
    domain: 'merchant',
    description: 'Merchant categories',
  },
  {
    id: 'merchant.store_settings',
    keyPattern: 'store_settings:{ownerId}',
    tier: 'medium',
    primaryLayer: 'application_l1',
    fallbackLayers: [],
    domain: 'merchant',
    description: 'Merchant store settings',
  },
  {
    id: 'merchant.orders_list',
    keyPattern: 'orders:{ownerId}:*',
    tier: 'short',
    primaryLayer: 'application_l1',
    fallbackLayers: [],
    domain: 'orders',
    description: 'Filtered order lists',
  },

  // --- Static / CDN ---
  {
    id: 'media.assets',
    keyPattern: 'cdn:*',
    tier: 'static',
    primaryLayer: 'cdn',
    fallbackLayers: ['browser'],
    domain: 'media',
    description: 'Product images and static media',
  },
  {
    id: 'marketing.public',
    keyPattern: 'marketing:public:{slug}',
    tier: 'long',
    primaryLayer: 'application_l1',
    fallbackLayers: ['edge'],
    domain: 'marketing',
    description: 'Public marketing pixels config',
  },

  // --- Platform ---
  {
    id: 'platform.health',
    keyPattern: 'platform:health',
    tier: 'short',
    primaryLayer: 'application_l1',
    fallbackLayers: [],
    domain: 'platform',
    description: 'Platform health check cache',
  },
];

export function listCacheAuditByTier(tier: CacheTier): CacheAuditEntry[] {
  return CACHE_AUDIT_REGISTRY.filter((e) => e.tier === tier);
}

export function listCacheAuditByDomain(domain: string): CacheAuditEntry[] {
  return CACHE_AUDIT_REGISTRY.filter((e) => e.domain === domain);
}

export function getCacheAuditSummary(): {
  total: number;
  never: number;
  short: number;
  medium: number;
  long: number;
  static: number;
  domains: string[];
} {
  const tiers = { never: 0, short: 0, medium: 0, long: 0, static: 0 };
  for (const e of CACHE_AUDIT_REGISTRY) tiers[e.tier]++;
  return {
    total: CACHE_AUDIT_REGISTRY.length,
    ...tiers,
    domains: [...new Set(CACHE_AUDIT_REGISTRY.map((e) => e.domain))],
  };
}
