# Load Test 404 — Root Cause Report

**Date:** 2026-06-25  
**Project:** `mpifosptgoxvroblrrte.supabase.co`  
**Slug tested:** `bidaya-demo`  
**Script:** `scripts/load-test.mjs`

---

## Executive summary

Load test showed **33.3% errors** (HTTP **404**) — exactly **1 of 3 RPCs** per session in **infra mode**.

**Root cause:** `get_store_products_page` failed at runtime with SQL error `function cardinality(jsonb) does not exist` inside `storefront_product_grid_json` (migration v57). PostgREST surfaced this as HTTP 404.

**Secondary cause:** `get_store_meta` had **two overloads** `(text)` and `(text, boolean)` causing PostgREST **300 PGRST203** ambiguity → `validateSlug()` failed → load test fell back to **infra mode** instead of realistic mode.

**Fix:** Migration `20260625000059_fix_storefront_cardinality_and_meta.sql` + `load-test.mjs` validateSlug param fix.

**After fix:** `npm run load:test -- --users=100 --duration=60 --slug=bidaya-demo` → **0.0% errors** through 100 concurrent users.

---

## 1. Request trace (`scripts/load-test.mjs`)

### Session modes

| Mode | Trigger | RPCs per session |
|------|---------|------------------|
| **realistic** (default) | `validateSlug()` succeeds | `get_storefront_page_bundle`, `track_store_visit_by_slug` |
| **infra** | slug invalid / meta ambiguous | `list_public_store_slugs`, `get_store_products_page`, `list_public_store_slugs` |
| **legacy** | `--mode=legacy` | bundle + products_page + visit |

### URL pattern (all RPCs)

```
POST {VITE_SUPABASE_URL}/rest/v1/rpc/{function_name}
Headers: apikey, Authorization: Bearer {anon_key}, Content-Type: application/json
```

### Edge functions

**Not called** by `load-test.mjs`. Production app may call:

```
GET {VITE_SUPABASE_URL}/functions/v1/get-store-products?slug=...
```

Probe shows **403 Origin not allowed** without browser Origin header (CORS by design).

---

## 2. Pre-fix probe results (`scripts/load-test-probe.mjs`)

| # | RPC / Edge | URL | Status | Response body (excerpt) |
|---|------------|-----|--------|-------------------------|
| 1 | `get_store_meta` | `/rest/v1/rpc/get_store_meta` | **300** | `PGRST203` — cannot choose between `get_store_meta(text)` and `get_store_meta(text, boolean)` |
| 2 | `list_public_store_slugs` | `/rest/v1/rpc/list_public_store_slugs` | 200 | `[{"store_slug":"bidaya-demo",...}]` |
| 3 | `get_store_products_page` | `/rest/v1/rpc/get_store_products_page` | **404** | `function cardinality(jsonb) does not exist` |
| 4 | `get_storefront_page_bundle` | `/rest/v1/rpc/get_storefront_page_bundle` | **404** | `function cardinality(jsonb) does not exist` |
| 5 | `track_store_visit_by_slug` | `/rest/v1/rpc/track_store_visit_by_slug` | 200 | `{"success": true}` |
| 6 | `get_store_products_by_slug` | `/rest/v1/rpc/get_store_products_by_slug` | **400** | `Returned type jsonb does not match expected type text[]` (sizes column) |
| 7 | Edge `get-store-products` | `/functions/v1/get-store-products` | 403 | `Origin not allowed` (expected for CLI) |

---

## 3. Root cause — code locations

### A) `cardinality(jsonb)` — HTTP 404 on products/bundle RPCs

**File:** `supabase/migrations/20260625000057_storefront_payload_optimization.sql`  
**Function:** `public.storefront_product_grid_json(p public.products)`  
**Line:** ~60

```sql
'sizes', CASE WHEN p.sizes IS NULL OR cardinality(p.sizes) = 0 THEN NULL ELSE to_jsonb(p.sizes) END,
```

**Problem:** On deployed DB, `products.sizes` is **JSONB**, not `TEXT[]`. PostgreSQL `cardinality()` accepts arrays only → runtime error → PostgREST **404**.

**Used by:**
- `get_storefront_page_bundle` (~line 289)
- `get_store_products_page` (~line 377)

### B) `get_store_meta` overload ambiguity — infra mode fallback

**File:** `scripts/load-test.mjs` — `validateSlug()` ~line 83–96  
**File:** v57 migration added `get_store_meta(text, boolean)` while v22/v56 single-arg version remained.

**Problem:** POST `{ p_slug }` only → PostgREST **300 PGRST203** → validation fails → session uses **infra mode** (3 RPCs, 1 failing = **33.3%**).

### C) Load test error accounting

**File:** `scripts/load-test.mjs` — `customerSession()` infra branch ~lines 125–136  
**File:** `runPhase()` ~lines 196–204  

Infra session: 2× `list_public_store_slugs` (OK) + 1× `get_store_products_page` (404) = **33.3% error rate**.

---

## 4. Fixes applied

### Migration v59

**File:** `supabase/migrations/20260625000059_fix_storefront_cardinality_and_meta.sql`

- Added `_product_sizes_to_jsonb()` / `_product_sizes_to_text_array()` helpers
- Patched `storefront_product_grid_json` to use helpers
- `DROP FUNCTION get_store_meta(text)` — single overload `(text, boolean default false)`
- Patched `get_store_products_by_slug` sizes cast

### Load test script

**File:** `scripts/load-test.mjs`

- `validateSlug`: send `{ p_slug, p_include_policies: false }`
- `rpc()`: return `url`, `body` snippet for diagnostics
- Print sample error bodies on failure

### Probe script (new)

**File:** `scripts/load-test-probe.mjs` — one-shot RPC + edge verification

---

## 5. Post-fix verification

### Probe (all storefront RPCs)

| RPC | Status |
|-----|--------|
| `get_store_meta` | 200 |
| `list_public_store_slugs` | 200 |
| `get_store_products_page` | 200 |
| `get_storefront_page_bundle` | 200 |
| `track_store_visit_by_slug` | 200 |
| `get_store_products_by_slug` | 200 |

### Load test

```
Store slug: bidaya-demo (realistic storefront (bundle + visit))
▶ 10 users  — err 0.0% | p95 363ms
▶ 25 users  — err 0.0% | p95 354ms
▶ 50 users  — err 0.0% | p95 353ms
▶ 100 users — err 0.0% | p95 ~350ms
```

**404 errors: 0%**

---

## 6. Edge function note

`get-store-products` returns **403** from CLI (no `Origin` header). This is **not** a load-test failure path. Set `ALLOWED_ORIGINS` in Supabase secrets for browser/production origins.
