import type { Product } from '@/types';
import { getProductLifecycleStatus } from '@/lib/productLifecycle';
import type { MerchantInventorySummary } from '@/services/read/inventory/inventoryReadService';

/** Client-side summary when merchant_inventory_summary RPC is unavailable. */
export function computeMerchantInventorySummaryFromProducts(
  products: Product[]
): MerchantInventorySummary {
  let published = 0;
  let draft = 0;
  let archived = 0;
  let totalUnits = 0;
  let retailValue = 0;
  let costValue = 0;
  let missingSku = 0;
  let missingImage = 0;
  let lowStock = 0;
  let outOfStock = 0;

  for (const p of products) {
    const lifecycle = getProductLifecycleStatus(p);
    if (lifecycle === 'archived') {
      archived += 1;
      continue;
    }
    if (lifecycle === 'draft') {
      draft += 1;
      continue;
    }
    published += 1;

    const qty = Math.max(p.stockQuantity ?? 0, 0);
    const min = p.lowStockThreshold ?? 5;
    totalUnits += qty;
    retailValue += qty * (p.price ?? 0);
    costValue += qty * (p.cost ?? 0);

    if (!p.sku?.trim()) missingSku += 1;
    if (!p.image?.trim()) missingImage += 1;

    if (qty === 0) outOfStock += 1;
    else if (qty <= min) lowStock += 1;
  }

  return {
    totalProducts: products.length,
    published,
    draft,
    archived,
    totalUnits,
    retailValue,
    costValue,
    missingSku,
    missingBarcode: 0,
    missingImage,
    lowStock,
    outOfStock,
    incomingUnits: 0,
    reservedUnits: 0,
  };
}
