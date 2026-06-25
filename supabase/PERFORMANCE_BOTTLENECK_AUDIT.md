# Performance Bottleneck Audit — Storefront Scale (500 → 1000+ users)

**Date:** 2026-06-19  
**Load test baseline:** 200 users 0% err · 500 users 1.1% err · 1000 users 41.5% err (timeouts)  
**Target:** 1000+ concurrent storefront visitors, <2% error rate  
**Migration applied:** `20260625000022_scale_500_to_1000.sql` (v32)

---

## Executive summary

The platform breaks around **500 concurrent storefront users** because **PostgREST connection saturation** and **redundant RPC work** compound under load. Each virtual user previously fired **3 sequential RPCs** (bundle + duplicate products page + visit write). At 1000 users that is **~3000 in-flight HTTP/DB requests**, exceeding Supabase connection and CPU limits on typical Pro/Micro tiers.

Root causes ranked by impact:

| Rank | Bottleneck | Impact |
|------|-----------|--------|
| 1 | Triple RPC per page view (load test + legacy clients) | 3× connection churn |
| 2 | Repeated slug→owner resolution per RPC | 3× index lookups per session |
| 3 | `get_storefront_page_bundle` nested `get_store_meta` + `get_store_products_page` | 4× slug lookups + 2× category scans |
| 4 | Visit tracking writes + trigger scan | Write amplification under viral traffic |
| 5 | `is_valid_store_visit` full `COUNT(*)` | Scans all hourly rows per IP |
| 6 | `trg_visits_daily_stats` `NOT EXISTS` on `store_visits` | O(n) per insert for unique visitors |
| 7 | Slug predicate mismatch (`lower(trim(col))`) vs index (`LOWER(col)`) | Seq scans on hot path |
| 8 | No Supavisor pooler in load test | Direct connections exhaust limit |

---

## 1. Database bottlenecks

### Connection pool exhaustion
- PostgREST opens **one DB connection per request** (unless using Supavisor transaction pooler on port 6543).
- Free tier: ~60 direct connections · Pro Micro: ~200 · Pro Small: ~400.
- At 1000 VUs × 3 RPCs → **~3000 requests/12s** → queueing → **12s client timeouts** → 41.5% errors.

### Write path under browse load
- `track_store_visit_by_slug`: slug lookup → 5-min dedupe EXISTS → hourly rate limit COUNT → INSERT → trigger.
- Under load test every VU hits visit RPC every iteration (~every 100–200ms) → **contention on `store_visits`**.

### Read path
- Product listing: keyset pagination on `(owner_id, created_at DESC, id DESC)` — good after v29/v32 indexes.
- Categories: small per-owner set, indexed via `idx_categories_owner_order`.

---

## 2. Slow queries (exact RPCs)

| RPC | Work per call (before v32) | Typical cost driver |
|-----|---------------------------|---------------------|
| `get_storefront_page_bundle` | slug×2 + meta + categories×2 + products | Nested RPC calls |
| `get_store_products_page` | slug×2 + product scan + jsonb_agg | Duplicate when bundle already fetched |
| `get_store_meta` | slug×2 + settings + categories | Called standalone + inside bundle |
| `track_store_visit_by_slug` | slug×2 + dedupe scan + COUNT + INSERT + trigger scan | Writes + trigger |
| `is_valid_store_visit` | COUNT(*) all rows in last hour | No early stop |
| `list_public_store_slugs` | UNION settings + stores | Infra probe only |

### Product listing query (inside RPC)
```sql
SELECT p.* FROM products p
WHERE p.owner_id = :owner
  AND archived_at IS NULL AND COALESCE(is_active,true)
  AND (category/search filters)
ORDER BY created_at DESC, id DESC
LIMIT 25;  -- limit+1 for has_more
```
Uses `idx_products_owner_storefront_created` (v32) or `idx_products_owner_category_created` when filtered.

---

## 3. Index report

### Existing (kept)
| Index | Table | Purpose |
|-------|-------|---------|
| `idx_store_settings_slug` | store_settings | `LOWER(store_slug)` unique |
| `idx_stores_slug_lower` | stores | Slug fallback |
| `idx_store_visits_owner_ip_created` | store_visits | Rate limit + dedupe |
| `idx_store_visits_owner_ip_path_created` | store_visits | 5-min path dedupe |
| `idx_products_owner_category_created` | products | Category filter + pagination |
| `idx_products_name_trgm` | products | ILIKE search |
| `idx_categories_owner_order` | categories | Store meta categories |

### Added in v32
| Index | Purpose |
|-------|---------|
| `idx_stores_slug_lower_trim` | Align stores slug lookup with `LOWER(store_slug) = lower(trim($1))` |
| `idx_products_owner_storefront_created` | Default storefront page `(owner_id, created_at DESC, id DESC)` partial active |

### New table (rollup)
| Object | Purpose |
|--------|---------|
| `store_visitor_daily_keys` PK `(owner_id, stat_date, visitor_ip)` | O(1) unique visitor detection in trigger |

### Predicate fix
All hot-path RPCs now use **`LOWER(store_slug) = lower(trim(p_slug))`** so PostgreSQL can use `idx_store_settings_slug` / `idx_stores_slug_lower`.

---

## 4. Product listing performance

**Before:** Bundle called nested RPCs → 4 slug resolutions + duplicate category fetch.  
**After (v32):** `get_storefront_page_bundle` resolves owner **once**, fetches settings by `owner_id`, categories once, products inline.

**Client (already optimized):**
- `loadStorefrontBundle()` + `peekStorefrontBundle()` — single RPC serves `useTenantStore` + `useStoreProductsPage` first page.
- In-memory TTL 120s + IndexedDB 5min for products, 10min for meta.
- Edge function `get-store-products` — 120s HTTP cache + 90s in-memory (enable `VITE_STOREFRONT_EDGE_ENABLED`).

**Cache candidates (recommended):**
| Resource | TTL | Layer |
|----------|-----|-------|
| Storefront bundle (slug, page 1) | 120–300s | Edge + client memory |
| Store meta | 300s | Client memory + IDB |
| Product page 2+ | 120s | Client only |
| Public slug list | 600s | CDN/edge |

---

## 5. Storefront performance

Per realistic session (production client):
1. **1×** `get_storefront_page_bundle` (or edge equivalent)
2. **1×** `track_store_visit_by_slug` (deferred 2.5s / idle, 30min sessionStorage dedupe)

**Not** a separate `get_store_products_page` on first load.

---

## 6. Visit tracking performance

**Before:**
- `is_valid_store_visit`: `COUNT(*)` over all hourly visits
- Trigger: `NOT EXISTS` scan of `store_visits` for same-day IP

**After (v32):**
- Rate limit: `NOT EXISTS (... OFFSET 9 LIMIT 1)` — stops at 10 rows
- Trigger: `INSERT INTO store_visitor_daily_keys ... ON CONFLICT DO NOTHING` + `GET DIAGNOSTICS ROW_COUNT`

**Client dedupe:** 30min sessionStorage per path + slug home key; `requestIdleCallback` defer.

**Pre-aggregate:** `store_daily_stats` already incremental; v32 makes unique visitor increment O(1).

---

## 7. Realtime subscriptions

Storefront browse path uses **no Realtime** — correct for scale.

Merchant dashboard (`merchantRealtimeHub`) patches React Query cache; scoped to authenticated merchants, not in load test path. No change required for storefront 1000-user target.

---

## 8. RPC performance summary

| RPC | v32 change |
|-----|-----------|
| `_resolve_store_owner_by_slug` | New internal helper — single indexed lookup |
| `get_store_meta` | Resolve once → fetch by `owner_id` |
| `get_store_products_page` | Shared resolver + `archived_at IS NULL` |
| `get_storefront_page_bundle` | Fully inlined — no nested RPC |
| `track_store_visit_by_slug` | Shared resolver |
| `is_valid_store_visit` | Early-exit EXISTS vs COUNT |

---

## 9. API request patterns

### Load test (updated)
| Mode | RPCs/session | Use |
|------|-------------|-----|
| `realistic` (default) | 2 | Matches production |
| `legacy` | 3 | Reproduces pre-fix duplicate |
| `infra` | 3 | No live store slug |

Run: `node scripts/load-test.mjs --users=1000 --duration=15 --slug=YOUR_SLUG`

### Production client flow
```
Store mount → loadStorefrontBundle (deduped)
           → useStoreProductsPage reads bundle cache (no 2nd RPC)
           → useStoreVisitTracking (idle, deduped)
```

---

## 10. React rendering performance

Store page findings (no blocking issues for DB scale):
- `useStoreProductsPage` + `useTenantStore` share bundle cache — **no duplicate network**.
- `useDebouncedValue(search, 300)` prevents RPC storm on typing.
- Product list uses pagination (`visibleCount` + sentinel) — good.
- Minor fix: removed duplicate import in `Store.tsx`.

Optional future: `React.memo` on `ProductCard` if profiling shows render cost at 48+ visible items.

---

## Applied optimizations (v32 + client + load test)

1. **Migration v32** — slug resolver, inlined bundle RPC, visit trigger O(1), storefront index, ANALYZE
2. **Load test** — realistic 2-RPC mode by default
3. **`resolveStoreOwnerBySlug`** — reads bundle cache before RPC
4. **`Store.tsx`** — duplicate import removed

### Deploy
```bash
npm run db:deploy
# Re-run load test after migration applies
node scripts/load-test.mjs --users=1000 --duration=20 --slug=demo
```

Enable edge caching in production:
```
VITE_STOREFRONT_EDGE_ENABLED=true
```

Use pooler URL for client if on Pro+:
```
VITE_SUPABASE_POOLER_URL=https://<ref>.pooler.supabase.com
```

---

## Expected capacity after optimization

| Scenario | Concurrent users | Error rate (est.) |
|----------|-------------------|-------------------|
| Before (3 RPC, direct conn, Micro) | ~400–500 | 1–5% |
| After v32 + realistic load test (direct conn) | ~700–900 | 2–5% |
| After v32 + Supavisor pooler (Pro) | **1000–1500** | **<2%** |
| After v32 + edge cache hit (>80%) | **1500–2500** | **<1%** |

Assumptions: single hot store slug, ~24 products/page, visit dedupe working, 12s timeout.

**Comfortable production target:** **1000 concurrent browsers** on Pro + pooler + edge enabled.

---

## Remaining limitations (Supabase plan)

| Limit | Free | Pro Micro | Pro Small | Mitigation |
|-------|------|-----------|-----------|------------|
| Direct DB connections | ~60 | ~200 | ~400 | Supavisor pooler (6543) |
| Pooler connections | 200 | 200 | 400+ | Transaction mode for RPC |
| CPU burst | Low | Shared | Dedicated option | Edge cache, read replicas |
| Realtime concurrent | 200 | 500 | 10k+ | N/A for storefront |
| Edge function CPU | 50ms wall | plan-based | scale tier | CDN cache headers |
| `store_visits` growth | Storage | Storage | Storage | Partition/archive >90d |
| Single-region latency | — | — | — | Multi-region read replica (Team+) |

**Hard ceiling without infrastructure change:** ~400 direct PostgREST connections regardless of query optimization. Pooler + caching are **required** for 1000+ sustained concurrency, not optional.

---

## Operations checklist

- [ ] Apply migration v32 (`npm run db:deploy`)
- [ ] Configure Supavisor URL in production env
- [ ] Enable `VITE_STOREFRONT_EDGE_ENABLED`
- [ ] Set `ALLOWED_ORIGINS` on edge functions
- [ ] Re-run load test in realistic mode
- [ ] Monitor: PostgREST queue time, `store_visits` insert rate, p95 bundle latency
- [ ] Schedule purge of `store_visitor_daily_keys` older than 90 days (cron/SQL)

---

## Query report quick reference

```sql
-- Slug resolve (indexed)
SELECT owner_id FROM store_settings WHERE LOWER(store_slug) = lower(trim($slug)) LIMIT 1;

-- Storefront products (indexed keyset)
SELECT ... FROM products WHERE owner_id = $1 AND archived_at IS NULL
ORDER BY created_at DESC, id DESC LIMIT 25;

-- Visit dedupe (indexed)
SELECT 1 FROM store_visits WHERE owner_id = $1 AND visitor_ip = $2 AND page_path = $3
  AND created_at > now() - interval '5 min' LIMIT 1;

-- Rate limit (indexed, early exit)
SELECT 1 FROM store_visits WHERE owner_id = $1 AND visitor_ip = $2
  AND created_at > now() - interval '1 hour' OFFSET 9 LIMIT 1;
```
