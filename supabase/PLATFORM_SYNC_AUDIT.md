# Platform ↔ Supabase Synchronization Audit

**Date:** 2026-06-16  
**Scope:** Full codebase vs migration chain (77 files) vs live Supabase (expected)  
**Required schema version:** 10 (`20260616000010_platform_sync_consolidation.sql`)

---

## Executive Summary

The application code assumes **schema v10** with the June 2026 migration chain (`20260616000001`–`20260616000010`). If the live Supabase project was last synced before June 2026, **checkout, publish, reviews, inventory, and dashboard KPIs will fail or behave inconsistently** even when the UI looks correct.

| Area | Status if migrations missing | Fix |
|------|------------------------------|-----|
| Checkout stock | False "غير متوفرة" errors | Apply `000007` + `000010` |
| Product publish | Drafts stay hidden on storefront | Apply `000008` |
| Merchant reviews | Pending reviews invisible | Apply `000008` |
| Dashboard stats | KPI RPC signature mismatch | Apply `20260615000003` + chain |
| Platform banner | Yellow health warning | Apply `000009`–`000010`, run `npm run db:verify` |

**Primary action:** Run `npm run db:deploy` (linked CLI) or paste bundled SQL from `npm run db:bundle` into Supabase SQL Editor.

---

## 1. Database Inconsistencies

### 1.1 TypeScript types vs migrations (`src/integrations/supabase/types.ts`)

| Object | In migrations | In types.ts | Impact |
|--------|---------------|-------------|--------|
| `stores` table | Yes (`20260613000001`) | **Missing** | Direct `.from('stores')` uses `(supabase as any)` |
| `products.archived_at` | Yes (`000005`) | **Missing** | Publish/lifecycle logic untyped |
| `products.store_id` | Yes | **Missing** | Multi-tenant queries untyped |
| `orders.payment_status` | Yes | **Missing** | Order list/detail selects may fail at runtime |
| `orders.delivery_status` | Yes | **Missing** | Same |
| `orders.store_id` | Yes | **Missing** | Store linkage untyped |
| `get_store_statistics` | `(p_owner_id, p_start, p_end)` | `(p_owner_id, p_days?)` | Stale signature in types |
| 30+ RPCs used in app | Yes | **Most missing** | Widespread `(supabase as any).rpc()` |

**Resolution:** Run `npm run db:types` after deploy; types patched in-repo for critical columns. Full regen requires `supabase link`.

### 1.2 Duplicate / superseded RPC definitions

`create_order_with_stock_deduction` is redefined across 8 migrations. **Authoritative version:** `20260616000007_checkout_stock_unified.sql`.

Storefront product RPCs redefined in `000005`, `000006`, `000003`. **Authoritative:** latest in chain + `000010` re-grants.

### 1.3 Profiles dual-key model

Migrations define `profiles.id = auth.users.id` and added `profiles.user_id` (synced to `id`). Types list both; app queried only `id`. **Fixed:** AuthContext now queries `id OR user_id`.

### 1.4 Storage

| Bucket | In migrations | Used in app |
|--------|---------------|-------------|
| `product-images` | Yes (public) | Product image upload |

No other buckets referenced in application code.

---

## 2. Missing Migrations (live Supabase risk)

If live DB predates June 2026, these are **critical missing** (in order):

| Migration | Purpose |
|-----------|---------|
| `20260616000001` | Checkout owner resolution + stock validation |
| `20260616000002` | Realtime orders + variant stock adjustment |
| `20260616000003` | Merchant catalog + `archived_at` lifecycle |
| `20260616000004` | Product column repair |
| `20260616000005` | Platform schema contract (storefront filters) |
| `20260616000006` | GRANTs + product view tracking |
| `20260616000007` | **Unified checkout stock** (variant vs aggregate) |
| `20260616000008` | **Publish + merchant reviews** |
| `20260616000009` | `platform_health_check` RPC |
| `20260616000010` | **Consolidation + health v10** |

Also required from earlier chain (if never applied):

- `20260613000001` — `stores` table + `store_id` FKs
- `20260615000003` — `get_store_statistics(p_start, p_end)`
- `20260615000010` — Auth trigger + `profiles.user_id`
- `20260615000004` — `attach_order_marketing_attribution`

---

## 3. Missing Relationships

| Relationship | Expected | Risk if missing |
|--------------|----------|-----------------|
| `products.store_id → stores.id` | Yes | Slug/store isolation breaks |
| `orders.store_id → stores.id` | Yes | Order–store linkage |
| `categories.store_id → stores.id` | Yes | Category scoping |
| `profiles.id → auth.users.id` | Yes | Auth profile load fails |
| `profiles.user_id → auth.users.id` | Yes (mirror) | Legacy rows with null `user_id` |
| `order_items.order_id → orders.id` | Yes | Order detail broken |
| `product_reviews.product_id → products.id` | Yes | Reviews broken |

**000010** backfills `store_id` on products/categories/orders from `stores.user_id = owner_id`.

---

## 4. Broken Queries (code → DB)

| Location | Query / RPC | Failure mode without migration |
|----------|-------------|-------------------------------|
| `orderService.ts` | `ORDER_LIST_SELECT` includes `payment_status`, `delivery_status` | Column does not exist → empty orders |
| `statisticsService.ts` | `get_store_statistics(p_start, p_end)` | Wrong overload / 404 |
| `storefrontProductService.ts` | `get_store_products_page` filters `archived_at IS NULL` | RPC missing → empty storefront |
| `dummyData.ts` | `publish_owner_product` | RPC missing → publish fails |
| `orderService.ts` | `create_order_with_stock_deduction` | Old RPC → false stock errors |
| `reviewService.ts` | `get_merchant_product_reviews` | Falls back to direct query (works but no owner guard in RPC path) |
| `platformHealthService.ts` | `platform_health_check` | Falls back to client probes |

**Client fallbacks exist** for reviews, health, and product updates — but checkout and publish **require** server RPCs.

---

## 5. Authentication Issues

| Issue | Severity | Status |
|-------|----------|--------|
| Profile load by `id` only | Medium | **Fixed** — OR `user_id` |
| `handle_new_user` trigger order | High | Requires `20260615000010` on live DB |
| `is_username_available` RPC | Low | Graceful fallback (assume available) |
| RLS on `profiles` uses `auth.uid() = id` | OK | Matches schema |
| Signup metadata → profile + subscription | High | Requires auth trigger migrations |

---

## 6. Product Workflow Issues

| Step | Dependency | Symptom if drift |
|------|------------|------------------|
| Create product | `products` columns + RLS | Insert fails / missing variants |
| Draft → Publish | `publish_owner_product`, `archived_at` | Product stays off storefront |
| Storefront list | `get_store_products_page`, `is_active`, `archived_at IS NULL` | Empty or shows drafts |
| Merchant list | `get_owner_products_page` | Pagination/filter broken |
| Bulk upload | Direct `products.insert` | Bypasses lifecycle helpers — may miss `store_id` |

**Code fixes applied:** `buildProductLifecyclePatch`, `publishProduct`, column fallbacks in `updateProduct`.

---

## 7. Inventory Workflow Issues

| Step | Dependency | Symptom if drift |
|------|------------|------------------|
| Stock display | `variants[].stock` + `stock_quantity` | UI shows stock, checkout rejects |
| Checkout validation | `product_checkout_available_qty` | Mismatch with `getAvailableQty()` |
| Order deduction | `create_order_with_stock_deduction` v7 | `stock_deduction_failed` |
| Inventory movements | `inventory_movements` table | Audit log insert may fail silently |
| Low stock KPI | `get_store_statistics.low_stock_count` | Dashboard badge wrong |

**Authoritative stock logic:** `20260616000007` — sum variant stock when `stock_quantity = 0`.

---

## 8. Checkout Workflow Issues

| Step | Dependency | Symptom |
|------|------------|---------|
| Resolve store | `resolve_checkout_owner` / slug | Wrong tenant or 404 |
| Cart refresh | `fetchCheckoutProductsByIds` | Stale qty, "العدد منتهي" |
| Background sync | Silent mode in `useCheckoutFlow` | **Fixed** — no fatal toasts |
| Place order | `create_order_with_stock_deduction` | Stock error toast |
| Idempotency | `orders.idempotency_key` unique | Duplicate orders on retry |
| Marketing | `attach_order_marketing_attribution` | Silent fail (non-blocking) |
| Delivery fee | `calculate_delivery_fee_by_slug` | Fee = 0 if RPC missing |

---

## 9. Multi-Tenant Issues

| Concern | Mechanism | Gap |
|---------|-----------|-----|
| Store isolation | `owner_id` on all merchant tables | OK in RLS |
| Slug routing | `store_settings.store_slug` + `stores.store_slug` | Code checks both — **000012**, **000005** unify |
| `store_id` FK | `stores` table | Missing on live if `20260613000001` not applied |
| Checkout tenant | `resolve_checkout_owner(p_slug)` | Missing → checkout fails |
| Cross-store cart | Client clears on slug change | OK |
| RLS anon storefront | SECURITY DEFINER RPCs | Requires GRANTs from **000006**, **000010** |

---

## Tables Inventory (28 in migration chain)

`profiles`, `stores`, `store_settings`, `products`, `categories`, `orders`, `order_items`, `customers`, `store_visits`, `product_reviews`, `suggested_products`, `inventory_movements`, `product_views`, `marketing_coupons`, `marketing_settings`, `order_refunds`, `order_chargebacks`, `order_payments`, `order_shipments`, `subscription_plans`, `store_subscriptions`, `platform_schema_version`, `restaurant_owners` (legacy), `audit_log` / security tables.

---

## RPCs Used by Application (35)

**Storefront:** `get_store_meta`, `get_store_by_slug`, `get_store_categories_by_slug`, `get_store_products_page`, `get_store_products_by_slug`, `get_store_product_by_id`, `track_store_visit_by_slug`, `track_product_view_by_slug`, `get_approved_product_reviews`, `submit_product_review_for_store`, `get_suggested_products_for_store`, `validate_store_coupon`, `validate_store_coupon_by_slug`, `calculate_delivery_fee`, `calculate_delivery_fee_by_slug`

**Merchant:** `get_store_for_user`, `get_owner_bootstrap`, `get_owner_products_page`, `publish_owner_product`, `get_merchant_product_reviews`, `approve_product_review`, `get_store_statistics`, `get_store_marketing_public`, `get_store_marketing_for_owner`

**Checkout/Orders:** `create_order_with_stock_deduction`, `attach_order_marketing_attribution`, `resolve_checkout_owner`, `product_checkout_available_qty`

**Payments/Delivery:** `get_order_payment_summary`, `record_order_refund`, `record_order_chargeback`, `get_order_shipment`, `update_shipment_status`, `mark_delivery_failed`, `retry_failed_delivery`

**Platform:** `platform_health_check`, `is_username_available`

---

## Unused / Legacy DB Objects (low priority)

- `get_store_products` (replaced by `get_store_products_page`)
- `restaurant_owners` table (legacy naming)
- `get_owner_orders_page` RPC — **not used** by current app (direct `orders` select instead)

---

## Verification Checklist

After applying migrations:

```bash
npm run db:verify          # platform_health_check → schema v10
npm run test               # unit tests
npm run build              # production build
```

Manual smoke tests:

1. **Auth** — Register/login, profile loads store name
2. **Products** — Create draft → Publish → visible on `/store/{slug}`
3. **Inventory** — Adjust variant stock → checkout accepts qty
4. **Checkout** — Guest order completes, no false stock error
5. **Orders** — Order appears in merchant dashboard (realtime)
6. **Dashboard** — Statistics load without KPI RPC error

---

## Deploy Commands

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
npm run db:deploy
npm run db:verify
npm run db:types   # merge types.generated.ts into types.ts
```

Without CLI:

```bash
npm run db:bundle   # creates supabase/apply-platform-sync-bundle.sql
```

Paste that file into **Supabase Dashboard → SQL Editor** in one run (idempotent).
