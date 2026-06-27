/**
 * Operation classification registry for CQRS-style read/write separation.
 * Used by audits and documentation — not enforced at runtime beyond readClient/writeClient.
 */
export type OperationKind = 'READ' | 'WRITE' | 'MIXED';

export type ClassifiedOperation = {
  id: string;
  kind: OperationKind;
  domain: string;
  service: string;
  description: string;
};

export const OPERATION_REGISTRY: ClassifiedOperation[] = [
  // Storefront reads
  { id: 'storefront.fetchBundle', kind: 'READ', domain: 'storefront', service: 'storefrontQueryService', description: 'Public storefront page bundle' },
  { id: 'storefront.fetchProductsPage', kind: 'READ', domain: 'storefront', service: 'storefrontQueryService', description: 'Paginated storefront products' },
  { id: 'storefront.invalidate', kind: 'WRITE', domain: 'storefront', service: 'storefrontCacheWriteService', description: 'Cache invalidation after merchant writes' },
  // Orders
  { id: 'orders.list', kind: 'READ', domain: 'orders', service: 'orderReadService', description: 'Filtered order list' },
  { id: 'orders.create', kind: 'WRITE', domain: 'orders', service: 'orderWriteService', description: 'Checkout order creation' },
  { id: 'orders.updateStatus', kind: 'WRITE', domain: 'orders', service: 'orderWriteService', description: 'Merchant status transition' },
  // Products
  { id: 'products.list', kind: 'READ', domain: 'products', service: 'productQueryService', description: 'Merchant catalog list' },
  { id: 'products.create', kind: 'WRITE', domain: 'products', service: 'productCommandService', description: 'Create product' },
  { id: 'products.update', kind: 'WRITE', domain: 'products', service: 'productCommandService', description: 'Patch product' },
  // Store settings
  { id: 'store.fetchSettings', kind: 'READ', domain: 'store', service: 'storeReadService', description: 'Merchant store profile' },
  { id: 'store.patchSettings', kind: 'WRITE', domain: 'store', service: 'storeWriteService', description: 'Settings mutation' },
  // Dashboard
  { id: 'dashboard.batch', kind: 'READ', domain: 'analytics', service: 'dashboardStatsService', description: 'KPI batch RPC' },
  // Inventory
  { id: 'inventory.movements', kind: 'READ', domain: 'inventory', service: 'inventoryReadService', description: 'Movement history' },
  { id: 'inventory.restock', kind: 'WRITE', domain: 'inventory', service: 'inventoryWriteService', description: 'Manual restock' },
  // Coupons
  { id: 'coupons.list', kind: 'READ', domain: 'marketing', service: 'couponReadService', description: 'Merchant coupons' },
  { id: 'coupons.validate', kind: 'READ', domain: 'marketing', service: 'couponReadService', description: 'Checkout coupon validation' },
  { id: 'coupons.mutate', kind: 'WRITE', domain: 'marketing', service: 'couponWriteService', description: 'CRUD coupons' },
];

export function listOperationsByKind(kind: OperationKind): ClassifiedOperation[] {
  return OPERATION_REGISTRY.filter((op) => op.kind === kind);
}

export function listMixedLegacyServices(): string[] {
  return [
    'storefrontProductService (read-primary; invalidation → storefrontCacheWriteService)',
    'merchantProductCatalogService (read-primary; cache sync on external writes)',
    'marketingService',
    'suggestedProductsService',
    'footerSuggestedProductsService',
    'reviewService',
    'storefrontReviewService',
    'platformHealthService',
  ];
}
