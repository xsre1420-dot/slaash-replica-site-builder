/**
 * Logical service boundaries for future independent deployment.
 * Single monolith today — modules map 1:1 to extractable services.
 */
export type ServiceId =
  | 'storefront'
  | 'checkout'
  | 'analytics'
  | 'notifications'
  | 'imports'
  | 'exports'
  | 'search'
  | 'background'
  | 'orders'
  | 'inventory'
  | 'marketing'
  | 'store'
  | 'media';

export type ServiceBoundary = {
  id: ServiceId;
  module: string;
  queues: string[];
  readServices: string[];
  writeServices: string[];
  /** When false, failures must not block checkout or order writes. */
  blocksCheckout: boolean;
  /** Primary data store — all writes route to primary PostgreSQL. */
  dataStore: 'primary' | 'read_replica' | 'outbox' | 'edge';
};

export const SERVICE_BOUNDARIES: ServiceBoundary[] = [
  {
    id: 'storefront',
    module: '@/modules/storefront',
    queues: ['cache'],
    readServices: ['storefrontQueryService', 'storefrontProductService'],
    writeServices: ['storefrontCacheWriteService'],
    blocksCheckout: false,
    dataStore: 'edge',
  },
  {
    id: 'checkout',
    module: '@/modules/checkout',
    queues: ['orders'],
    readServices: ['orderReadService', 'couponReadService'],
    writeServices: ['orderWriteService'],
    blocksCheckout: true,
    dataStore: 'primary',
  },
  {
    id: 'orders',
    module: '@/modules/orders',
    queues: ['orders', 'webhook'],
    readServices: ['orderReadService'],
    writeServices: ['orderWriteService'],
    blocksCheckout: false,
    dataStore: 'primary',
  },
  {
    id: 'analytics',
    module: '@/modules/analytics',
    queues: ['analytics'],
    readServices: ['dashboardStatsService', 'statisticsService'],
    writeServices: [],
    blocksCheckout: false,
    dataStore: 'outbox',
  },
  {
    id: 'notifications',
    module: '@/modules/background',
    queues: ['notifications', 'webhook'],
    readServices: [],
    writeServices: [],
    blocksCheckout: false,
    dataStore: 'outbox',
  },
  {
    id: 'imports',
    module: '@/modules/products',
    queues: ['import'],
    readServices: ['productQueryService'],
    writeServices: ['productCommandService', 'importJobService'],
    blocksCheckout: false,
    dataStore: 'primary',
  },
  {
    id: 'exports',
    module: '@/modules/products',
    queues: ['export'],
    readServices: ['productQueryService', 'orderReadService'],
    writeServices: [],
    blocksCheckout: false,
    dataStore: 'primary',
  },
  {
    id: 'media',
    module: '@/modules/store',
    queues: ['image'],
    readServices: [],
    writeServices: [],
    blocksCheckout: false,
    dataStore: 'outbox',
  },
  {
    id: 'search',
    module: '@/modules/storefront',
    queues: ['search'],
    readServices: ['storefrontQueryService'],
    writeServices: [],
    blocksCheckout: false,
    dataStore: 'read_replica',
  },
  {
    id: 'background',
    module: '@/modules/background',
    queues: ['orders', 'inventory', 'notifications', 'analytics', 'import', 'export', 'image', 'webhook', 'cache', 'search'],
    readServices: ['backgroundJobsService'],
    writeServices: [],
    blocksCheckout: false,
    dataStore: 'outbox',
  },
  {
    id: 'inventory',
    module: '@/modules/inventory',
    queues: ['inventory'],
    readServices: ['inventoryReadService'],
    writeServices: ['inventoryWriteService'],
    blocksCheckout: false,
    dataStore: 'primary',
  },
  {
    id: 'marketing',
    module: '@/modules/marketing',
    queues: ['cache'],
    readServices: ['couponReadService', 'marketingService'],
    writeServices: ['couponWriteService'],
    blocksCheckout: false,
    dataStore: 'read_replica',
  },
  {
    id: 'store',
    module: '@/modules/store',
    queues: ['cache', 'image'],
    readServices: ['storeReadService'],
    writeServices: ['storeWriteService'],
    blocksCheckout: false,
    dataStore: 'primary',
  },
];

export function getServiceBoundary(id: ServiceId): ServiceBoundary | undefined {
  return SERVICE_BOUNDARIES.find((s) => s.id === id);
}

export function listExtractableServices(): ServiceId[] {
  return SERVICE_BOUNDARIES.map((s) => s.id);
}
