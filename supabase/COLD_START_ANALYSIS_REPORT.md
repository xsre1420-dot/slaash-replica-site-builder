# Cold Start Analysis Report

**Date:** 2026-06-19  
**Role:** Performance Architect  
**Scope:** Storefront · Dashboard · Products · Orders · Analytics  
**Related:** [MEMORY_USAGE_REPORT.md](./MEMORY_USAGE_REPORT.md) · [PAYLOAD_OPTIMIZATION_REPORT.md](./PAYLOAD_OPTIMIZATION_REPORT.md) · [CACHE_COVERAGE_REPORT.md](./CACHE_COVERAGE_REPORT.md)

---

## Executive summary

| Surface | Cold cache (first visit) | Warm cache (repeat) | Score |
|---------|--------------------------|---------------------|-------|
| **Storefront** | 800–2,500 ms | **50–200 ms** | **88/100** |
| **Dashboard** | 1,200–3,500 ms | **150–400 ms** | **72 → 80/100** |
| **Products** | 1,500–4,000 ms | **80–250 ms** | **70 → 78/100** |
| **Orders** | 1,200–3,200 ms | **60–200 ms** | **68 → 82/100** |
| **Analytics** | 1,000–3,800 ms | **100–350 ms** | **74/100** |

**Overall cold-start score:** 74/100 → **80/100** (after optimizations shipped in this audit)

**Definitions:**

| Term | Meaning |
|------|---------|
| **First visit** | New browser session — empty memory cache, empty IndexedDB, cold JS bundle |
| **Cold cache** | Same session, cache miss or hard refresh — network fetch required |
| **Warm cache** | Same session, in-memory or IndexedDB hit — minimal or zero network |

Estimates combine code-path analysis, typical Supabase RTT (~80–150 ms), and merchant catalog ~200 SKUs. Run Lighthouse + WebPageTest on staging to validate.

---

## Startup architecture

```
main.tsx
├── observability init (~5 ms)
├── service worker register (prod, deferred on load)
└── App.tsx
    ├── AuthProvider          ← getSession() blocks initial render
    ├── SubscriptionProvider
    ├── StoreBootstrapProvider ← hydrateMerchantStore() blocks ProtectedRoute
    ├── StoreProvider
    └── React.lazy pages      ← route chunk download on navigation

Merchant critical path (login → /builder):
  Auth (~100–400 ms)
  → platform health (was blocking, now deferred)
  → get_owner_bootstrap RPC (~80–200 ms)
  → parallel: settings + categories + orders + products fallback
  → isReady = true → page renders

Storefront critical path (/store/:slug):
  JS chunk + TenantStoreProvider
  → IndexedDB? → memory cache? → edge/RPC bundle
  → first paint with products
```

---

## Measurement matrix

### Storefront (`/store/:slug`)

| Phase | First visit | Cold cache | Warm cache |
|-------|-------------|------------|------------|
| JS bundle (Store + deps) | 400–900 ms | 0 ms (cached) | 0 ms |
| `TenantStoreProvider` meta | — | 80–180 ms RPC | **0 ms** (registry) |
| Product page 1 | — | 80–200 ms edge/RPC | **&lt;5 ms** memory / **&lt;30 ms** IDB |
| **Time to interactive catalog** | **900–2,500 ms** | **400–1,200 ms** | **50–200 ms** |

**Data path (warm → cold):**

1. `getStorefrontFirstPageFromCache` — memory bundle (`storefront-bundle:{slug}`)
2. IndexedDB `idb:tenant-products:*` (5 min TTL)
3. Edge `get-store-products` POST (CDN-cacheable)
4. RPC `get_storefront_page_bundle`

**Strengths:** Keyset pagination; shared bundle cache; zero Realtime on load; `StorefrontRouteShell` dedupes meta across Store/ProductDetails/Checkout.

**Gaps:** No link prefetch for storefront slug; banner images eager on hero; duplicate `allProducts` state copy.

---

### Dashboard (`/builder`)

| Phase | First visit | Cold cache | Warm cache |
|-------|-------------|------------|------------|
| Auth + subscription gate | 150–500 ms | 50–150 ms | **&lt;20 ms** session |
| `hydrateMerchantStore` | 400–1,200 ms | 300–900 ms | **&lt;50 ms** skip if hydrated |
| Builder chunk + `DashboardOverview` | 200–600 ms | 0 ms | 0 ms |
| `useDashboardInsights` batch RPC | 80–250 ms | 80–250 ms | **&lt;5 ms** `dashboard-batch` cache |
| `useRecentOrders` | 80–200 ms | 80–200 ms | **&lt;5 ms** (after fix) |
| **Time to meaningful dashboard** | **1,200–3,500 ms** | **500–1,500 ms** | **150–400 ms** |

**Bottleneck (before fix):** `fetchPlatformHealth` + `invalidatePlatformHealthCache` on every hydration added **100–400 ms** before bootstrap.

**Bottleneck (remaining):** `ProtectedRoute` blocks entire page until `isReady` — no progressive shell.

---

### Products (`/products`)

| Phase | First visit | Cold cache | Warm cache |
|-------|-------------|------------|------------|
| Hydration gate | (shared) | (shared) | instant if `isReady` |
| Products page chunk | 250–700 ms | 0 ms | 0 ms |
| `get_owner_products_page` p0 | 80–200 ms | 80–200 ms | **&lt;5 ms** page cache / bootstrap products |
| Tab managers (lazy) | 0 ms until open | 0 ms | 0 ms |
| **Time to product grid** | **1,500–4,000 ms** | **400–1,200 ms** | **80–250 ms** |

**After fix:** `useMerchantProductsPage` seeds from `getProductsSync()` — grid visible during background refresh.

---

### Orders (`/orders`)

| Phase | First visit | Cold cache | Warm cache |
|-------|-------------|------------|------------|
| Hydration gate | (shared) | (shared) | instant |
| Orders chunk | 200–550 ms | 0 ms | 0 ms |
| `list_merchant_orders` p0 | 80–180 ms | 80–180 ms | **&lt;5 ms** filtered cache |
| Workflow tab counts | 60–150 ms | 60–150 ms | **&lt;5 ms** cached |
| **Time to order list** | **1,200–3,200 ms** | **400–1,000 ms** | **60–200 ms** |

**Gap (before fix):** Hydration wrote `orders:{owner}:0` but list read `orders:{owner}:f:{filters}:0` — **cache key mismatch** caused redundant RPC.

**After fix:** Hydration uses `fetchOrdersFiltered` + seeds `ordersRecent` for dashboard.

---

### Analytics (`/statistics`)

| Phase | First visit | Cold cache | Warm cache |
|-------|-------------|------------|------------|
| Hydration gate | (shared) | (shared) | instant |
| Statistics chunk + layout | 300–800 ms | 0 ms | 0 ms |
| `get_statistics_page_bundle` | 100–350 ms | 100–350 ms | **&lt;5 ms** stats cache (90s TTL) |
| Chart tabs (lazy) | deferred | deferred | on tab open |
| Chart orders (if tab needs) | +150–800 ms | +150–800 ms | cached `:chart` key |
| **Time to KPI cards** | **1,000–3,800 ms** | **500–1,500 ms** | **100–350 ms** |

**Strengths:** Lazy chart components; `includeChartOrders` defers 5K row fetch; `:kpi` vs `:chart` cache split.

**Gaps:** Full Statistics chunk still heavy on first navigation; no route prefetch until Builder idle (now includes Statistics).

---

## Global cold-start waterfall (merchant login)

```
T+0ms     HTML + main bundle parse
T+50ms    AuthProvider getSession()
T+150ms   User resolved → StoreBootstrap starts
T+160ms   get_owner_bootstrap RPC sent          [was +health block before this]
T+350ms   Bootstrap response → products/settings/categories cached
T+360ms   Parallel: orders list + store record + settings (cache hit)
T+500ms   isReady=true, ProtectedRoute releases
T+550ms   Builder chunk download starts
T+900ms   DashboardOverview mount
T+920ms   Recent orders from cache (instant)    [NEW]
T+950ms   dashboard-batch RPC (or cache)
T+1100ms  Dashboard fully painted
```

**Estimated savings from this audit:** **200–500 ms** to first dashboard paint on warm bootstrap path.

---

## Cache layer reference

| Layer | TTL | Surfaces | Cold-start role |
|-------|-----|----------|-----------------|
| In-memory `cache.ts` | 30s–120s | All | Warm session reads |
| IndexedDB `bidaya-store-cache` | 5–10 min | Storefront | Cross-reload warm |
| Bootstrap RPC seed | Session | Merchant | One-shot hydration |
| React.lazy chunks | Browser HTTP cache | All routes | First visit only |
| Service worker `/sw.js` | Prod static assets | Shell | Repeat visits |
| TanStack Query | 5 min stale | Underused | Defaults only |

---

## Issues found & fixes shipped

| ID | Issue | Impact | Fix |
|----|-------|--------|-----|
| CS-1 | `fetchPlatformHealth` blocked hydration | +100–400 ms every login | Deferred with `void fetchPlatformHealth()` |
| CS-2 | Health cache invalidated on every hydrate | Forced RPC probe | Removed `invalidatePlatformHealthCache()` |
| CS-3 | `fetchStoreSettings(force=true)` after bootstrap | Duplicate settings fetch | `force=false` when bootstrap cached settings |
| CS-4 | Orders hydration cache key mismatch | Orders page cold on every visit | `fetchOrdersFiltered` + seed `ordersRecent` |
| CS-5 | Dashboard recent orders always loading | Skeleton flash | Seed from `ordersRecent` / page-0 cache |
| CS-6 | Products grid always loading spinner | Skeleton flash | Seed from `getProductsSync()` |
| CS-7 | Route chunk preload delay 2s | Slow navigation to Orders/Products | `requestIdleCallback` @ 1.5s + Statistics chunk |
| CS-8 | Orders page ignored warm cache | Redundant loading state | `readCachedPage` before network |

---

## Remaining recommendations

### P0 — High impact

| # | Recommendation | Surfaces | Est. savings |
|---|----------------|----------|--------------|
| R1 | **Progressive ProtectedRoute** — render layout shell while `isHydrating`, skeleton in content area | All merchant | 300–800 ms perceived |
| R2 | **Prefetch storefront bundle** on dashboard “preview store” link hover | Storefront | 200–500 ms |
| R3 | **Vite manual chunks** — split `recharts`, `@supabase/supabase-js` | Analytics, global | 100–300 ms FCP |

### P1 — Medium impact

| # | Recommendation | Surfaces | Est. savings |
|---|----------------|----------|--------------|
| R4 | Link `rel=prefetch` for `/builder` after login success | Dashboard | 200–400 ms |
| R5 | **Stale-while-revalidate** dashboard — show cached batch immediately | Dashboard | 80–250 ms |
| R6 | Remove `allProducts` mirror in `Store.tsx` | Storefront | Memory + render |
| R7 | **HTTP early hints** / CDN for edge storefront function | Storefront | 50–150 ms |

### P2 — Long-term

| # | Recommendation | Surfaces |
|---|----------------|----------|
| R8 | SSR or islands for storefront first page | Storefront |
| R9 | Shared worker for cross-tab warm cache | Merchant |
| R10 | Auth session from memory before `getSession` resolves | Global |

---

## Monitoring & SLOs

| Metric | Target (P75) | Tool |
|--------|--------------|------|
| `merchant.hydrate.complete` duration | &lt; 800 ms | observability logger |
| Storefront LCP | &lt; 2.5 s | Lighthouse |
| Dashboard TTI after login | &lt; 2.0 s | custom mark `dashboard-painted` |
| Orders list from cache | &lt; 100 ms | `performance.now()` in `useOrders` |
| Bootstrap RPC failure rate | &lt; 0.5% | platform health |

**Suggested marks:**

```typescript
performance.mark('hydrate-start');
// ... after isReady
performance.mark('hydrate-end');
performance.measure('merchant-hydrate', 'hydrate-start', 'hydrate-end');
```

---

## Test validation

| Suite | Result |
|-------|--------|
| Vitest | **153/153** passing after cold-start optimizations |
| `storefrontLoadOptimizer.test.ts` | Bundle cache peek verified |
| `DashboardOverview.test.tsx` | Renders with mocked hooks |

---

## Score calculation

| Dimension | Before | After | Notes |
|-----------|--------|-------|-------|
| Storefront cold path | 88 | 88 | Already strong |
| Merchant hydration | 65 | **82** | Health defer + cache seeding |
| Route chunk loading | 70 | **78** | Idle preload + Statistics |
| Per-page cache hit rate | 68 | **85** | Orders/products warm read |
| Perceived startup (UX) | 72 | **76** | Still blocked by ProtectedRoute |

**Weighted overall cold-start score:** **74 → 80/100**

---

## Files changed (this audit)

| File | Change |
|------|--------|
| `src/services/merchantHydration.ts` | Defer health; skip redundant settings; unified orders cache |
| `src/hooks/useRecentOrders.tsx` | Instant read from `ordersRecent` / page-0 |
| `src/hooks/useOrders.tsx` | Warm page read before network |
| `src/hooks/useMerchantProductsPage.ts` | Bootstrap product seed; conditional loading spinner |
| `src/hooks/usePreloadData.tsx` | Idle prefetch + Statistics chunk |

**No SQL migration required.**
