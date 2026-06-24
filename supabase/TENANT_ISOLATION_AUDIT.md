# Multi-Tenant Isolation Security Audit

**Date:** 2026-06-24  
**Schema target:** v27 (`20260625000017_tenant_isolation_security.sql`)  
**Project:** `mpifosptgoxvroblrrte`

---

## Executive Summary

| Domain | Isolation model | Status |
|--------|-----------------|--------|
| Products / Categories | RLS `tenant_row_owned(owner_id, store_id)` | ✅ Hardened v27 |
| Orders / Order items | RLS + RPC auth checks | ✅ |
| Inventory | `increment_product_stock` + RLS | ✅ Hardened v27 |
| Dashboard / Analytics | `get_store_statistics`, batch RPC | ✅ auth.uid() gate |
| Store settings | RLS `owner_id = auth.uid()` | ✅ |
| Storage (`product-images`) | Folder = `{user_id}/…` writes; public reads | ✅ By design |
| Checkout (anon) | Slug-bound SECURITY DEFINER RPCs | ✅ Hardened v27 |
| Admin / Leads | `is_platform_admin()` only | ✅ |

**Verdict:** No merchant can read/write another merchant's data via PostgREST when v27 is deployed. Residual risk: public storefront reads (intentional) and world-readable product images (CDN tradeoff).

---

## Isolation Layers

```
Client (owner_id from auth.uid())
    ↓
PostgREST + RLS (tenant_row_owned / owner_id policies)
    ↓
SECURITY DEFINER RPCs (auth.uid() = p_owner_id OR slug-bound)
    ↓
store_id FK + auth_user_store_ids() defense-in-depth
```

---

## RLS Coverage (all merchant tables)

| Table | Policy | store_id |
|-------|--------|----------|
| products | `tenant_row_owned` | ✅ |
| orders | `tenant_row_owned` | ✅ |
| order_items | via parent order | ✅ |
| categories | `tenant_row_owned` | ✅ |
| customers | `tenant_row_owned` | ✅ |
| store_settings | `owner_id = auth.uid()` | N/A (1:1) |
| inventory_movements | `owner_id = auth.uid()` | owner-only |
| product_reviews | owner SELECT; INSERT bound to product owner | owner-only |
| marketing_* | `owner_id = auth.uid()` | owner-only |
| store_visits / product_views | owner SELECT only | analytics |
| shipments / payment_transactions | owner access | owner-only |
| leads | platform admin only | N/A |

Direct `INSERT` on `orders` / `order_items` **revoked** — checkout only via `create_order_with_stock_deduction`.

---

## Storage Policies

| Operation | Rule |
|-----------|------|
| SELECT | Public read entire `product-images` bucket (storefront CDN) |
| INSERT/UPDATE/DELETE | `auth.uid()::text = folder[1]` — users only write under their UUID folder |

Client `imageUpload.ts` + `deleteImage()` double-check folder ownership.

---

## Issues Found & Fixed (v27)

### Critical — `checkout_resolve_duplicate_order` callable by anon

**Risk:** Attacker supplies victim `owner_id` + guessed idempotency key → learns order existence + total.

**Fix:** `REVOKE` from `anon`/`authenticated`; `GRANT` to `service_role` only. Still callable internally from `create_order_with_stock_deduction` (SECURITY DEFINER).

### High — `get_order_by_idempotency_key` trusted client `owner_id`

**Risk:** Anonymous caller passes arbitrary `p_owner_id`.

**Fix:** Anon path ignores `p_owner_id`; resolves owner **only** via `p_store_slug`. Authenticated path requires `auth.uid() = p_owner_id`. Rate limit added.

### Medium — `is_payment_method_allowed` cross-tenant probe

**Risk:** Authenticated user queries any owner's enabled payment methods.

**Fix:** Return `false` when `auth.uid() <> p_owner_id`. Triggers still work (`auth.uid()` null during checkout).

### Medium — `tenant_row_owned` NULL store_id bypass

**Risk:** Rows with `store_id IS NULL` skip store membership check.

**Fix:** Require `store_id IN auth_user_store_ids()` when set; allow NULL only if user has no store row yet (onboarding).

### Low — `increment_product_stock` store binding

**Fix:** Verify product `store_id` ∈ `auth_user_store_ids()` when present.

### Cleanup — duplicate storage read policy removed

---

## Frontend Access Patterns (verified)

All merchant services filter by `user.id` / `ownerId` from auth context:

- **Products:** `productsCrudService`, `useMerchantProductsPage` → RPC + RLS
- **Inventory:** `inventoryService` → `increment_product_stock` RPC
- **Orders:** `orderService` → `list_merchant_orders` + `.eq('owner_id')`
- **Analytics:** `statisticsService`, `dashboardStatsService` → RPC with owner from auth
- **Marketing:** `.eq('owner_id', user.id)`
- **Reviews:** `reviewService` + slug RPC for storefront

No client path passes user-controlled victim UUID without RLS/RPC gate.

---

## Tenant Isolation Test Suite

```bash
npm run db:deploy          # apply v27 first
npm run db:isolation-test  # 8 automated probes (anon key)
```

Tests verify: no order/product leaks, stats/dashboard blocked, checkout probe RPCs locked, storefront still public.

---

## Deploy Checklist

1. `npm run db:deploy` — applies `20260625000017_tenant_isolation_security.sql`
2. `npm run db:isolation-test` — expect 8/8 pass
3. `npm run test` — unit tests
4. Manual: login as merchant A, confirm cannot open merchant B order URL

---

## Residual Accepted Risks

1. **Public storefront** — slug-scoped product reads (required for eCommerce)
2. **Public image URLs** — all bucket objects readable (CDN); writes still isolated
3. **Analytics tables** — owner_id-only RLS (no store_id column); sufficient for single-store-per-owner model
