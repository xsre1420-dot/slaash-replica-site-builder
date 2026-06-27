# Product Lifecycle Sync Audit

**Date:** 2026-06-19  
**Scope:** Products ↔ Inventory ↔ Storefront ↔ Categories ↔ Images ↔ Archived products

## Systems Mapped

| Layer | Source | Visibility rule |
|-------|--------|-----------------|
| Merchant catalog | `dummyData.ts` / `productsCrudService` | All lifecycle states |
| Inventory | `inventoryService` + `inventoryPageUtils` | Stock + lifecycle badges |
| Storefront | `storefrontProductService` + edge `get-store-products` | `is_active` + `archived_at IS NULL` |
| Categories | `categories` table + denormalized `products.category` string | Name-based filter on storefront |
| Images | `image_url` / `additional_images` + storage cleanup on delete | Required before merchant save |
| Archive | `archived_at` + `is_active=false` via `publish_owner_product` / lifecycle patches | Hidden from storefront RPC |

## Issues Found & Fixed

### P0 — Publishing failures

| Issue | Root cause | Fix |
|-------|------------|-----|
| New products not on storefront after save | `addProduct` called `publish_owner_product` with invalid `p_owner_id`, ignored RPC errors, invalidated cache without published row | Match `publishProduct` flow: single-arg RPC, check response, fallback to `setProductLifecycle`, sync cache with returned product |

### P0 — Storefront cache staleness

| Issue | Root cause | Fix |
|-------|------------|-----|
| Published edits invisible up to 5 min | `invalidateStorefrontForOwner` cleared memory cache only; IndexedDB TTL 5 min | `cacheDeleteByPrefix` on `idb:tenant-products:{slug}`; storefront hook refetch purges IDB |

### P1 — Realtime invalidation gaps

| Issue | Root cause | Fix |
|-------|------------|-----|
| Name/category/image changes not refreshing storefront | `useRealtimeProducts` only watched stock/price fields | Expanded to full storefront field set |

### P1 — Inventory archive display

| Issue | Root cause | Fix |
|-------|------------|-----|
| Wrong archive date in inventory | `archivedAt` mapped from `created_at` | Pass `archived_at` through `InventoryProductRow` |

### P1 — Category rename desync

| Issue | Root cause | Fix |
|-------|------------|-----|
| Renamed category empty on storefront filter | Products store category **name** string, not FK | `updateCategory` cascades rename to `products.category` + catalog invalidation |

### P1 — Bulk upload bypass

| Issue | Root cause | Fix |
|-------|------------|-----|
| No inventory audit trail; duplicate rows in CSV | Direct insert, no movements, no dedupe | Dedupe by name; record `initial_stock` movements; clarify draft toast |

### P1 — Merchant cache inconsistency

| Issue | Root cause | Fix |
|-------|------------|-----|
| Stale paginated product list after mutation | `syncMerchantProductCatalog` did not clear root list key | `cache.del(CacheKeys.products(ownerId))`; unified `productCacheSync` delegate |

## Remaining Recommendations (not in this patch)

1. **Category FK migration** — store `category_id` on products instead of denormalized name (eliminates rename cascade).
2. **Bulk publish** — optional “publish all after upload” using `publish_owner_product` batch.
3. **Initial stock + variants** — route `addProduct` initial stock through `increment_product_stock` when variants present (DB v27 already scales variants on restock).
4. **Deploy v27** — tenant isolation hardening for `increment_product_stock` store membership check.

## Verification Checklist

- [ ] Create product with “publish” → appears on storefront within one refresh
- [ ] Rename category → storefront category filter still lists products
- [ ] Archive product → removed from storefront; inventory shows archived badge with correct date
- [ ] Bulk CSV upload → drafts in merchant panel; movements logged for stock > 0
- [ ] Edit product name on device A → storefront on device B updates after realtime event
- [ ] `npm test` passes
