# Phase 6 — Enterprise Memory, Rendering & Bundle Audit

**Date:** 2026-07-11  
**Mode:** Analysis only — no code, package, migration, or config changes  
**Build verified:** `npm run build` ✓ (production chunk analysis included)  
**Static audits:** `scripts/frontend-render-audit.mjs`, `scripts/memory-leak-audit.mjs` (656 files scanned)

---

## Executive Summary

The frontend is a **Vite + React 18 SPA** with strong foundations: **route-level lazy loading**, **manual vendor chunk splitting**, **split CartContext**, **progressive list rendering**, **L1 cache with LRU + TTL + periodic prune**, and **CDN-aware OptimizedImage**. Merchant hydration is **deferred on public routes**.

| Dimension | Score | Verdict |
|-----------|-------|---------|
| Memory | 86/100 | Good lifecycle hygiene; minor unbounded Sets |
| CPU | 82/100 | Statistics + large catalog filtering are hotspots |
| Bundle | 78/100 | Heavy vendor-ui + charts; good lazy routes |
| Rendering | 80/100 | Low memo coverage; context chain depth |
| Navigation | 84/100 | Lazy routes + L1 cache warm paths |
| **Overall Performance** | **82/100** | Production-ready; optimize at 1k+ products / long sessions |

**Can scale to thousands of concurrent users?**
- **Storefront visitors:** Yes — paginated catalog, progressive render, edge cache, 0 Realtime WS.
- **Concurrent merchants (dashboard):** Yes to ~1,000 with current patterns; **10,000-product catalogs** and **Statistics realtime refetch** become client CPU/memory bottlenecks before network.

---

## Memory Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BROWSER TAB (per user)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  React Tree                                                              │
│  QueryClientProvider → AuthProvider → SubscriptionProvider → StoreProvider│
│    → CartProvider → StoreBootstrapProvider → lazy page routes            │
├─────────────────────────────────────────────────────────────────────────┤
│  LONG-LIVED IN-PROCESS STORES                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ L1 cache Map     │  │ merchantRealtime │  │ imageLoadCache Set   │  │
│  │ max 2000 entries │  │ Hub Map/userId   │  │ (loaded URLs, ∞*)    │  │
│  │ TTL + LRU evict  │  │ + heartbeat      │  │                      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ inflight dedup   │  │ JobQueue         │  │ localMutationGuard   │  │
│  │ Map              │  │ localStorage/IDB │  │ Maps (lazy expiry)   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  TIMERS / LISTENERS (lifecycle-managed)                                  │
│  • cache prune interval (5 min, skip hidden tab)                         │
│  • background worker poll (150ms–2s adaptive)                          │
│  • Realtime heartbeat (25s, skip hidden)                               │
│  • visibilitychange hooks (cache, realtime, workers, orders)             │
│  • Service worker (prod only)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│  DOM / GPU MEMORY                                                        │
│  • Decoded images (OptimizedImage, lazy loading, srcSet thumbnails)      │
│  • Recharts SVG (Statistics — lazy tab chunks)                           │
│  • framer-motion (landing only — separate chunk)                         │
└─────────────────────────────────────────────────────────────────────────┘
  * imageLoadCache grows with unique URLs viewed; no cap today
```

---

## Render Flow

```
User action / Realtime event
        │
        ▼
┌───────────────────┐     Auth/Subscription state change
│ Context providers │ ──► re-render all context consumers (no split on Auth)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     useMemo/useCallback on hot pages (Store, Products, Orders)
│ Page component    │ ──► DashboardLayout NOT memoized — wraps every dashboard page
└─────────┬─────────┘
          │
          ├──► L1 cache read (syncFromCache) — Products/Inventory ✅ low render cost
          ├──► refetch() RPC — Orders/Statistics ⚠️ high cost
          └──► Progressive slice — Products/Inventory/Store (batch 48–100) ✅

Cart: split CartStateContext / CartActionsContext
      Store page uses useCartActions only → ~88% fewer add-to-cart renders vs monolith
```

---

## STEP 1 — Memory Audit

### React State & Contexts

| Store | Location | Lifetime | Bounded? |
|-------|----------|----------|----------|
| Auth user | `AuthContext` | Session | ✅ |
| Subscription | `SubscriptionContext` | Session | ✅ |
| Store settings | `StoreContext` | Session | ✅ |
| Cart items | `CartContext` (split) | Session + sessionStorage | ✅ |
| Bootstrap hydration | `StoreBootstrapContext` | Session | ✅ |
| Page-local state |各 pages | Route mount | ✅ unmount clears |

**7 context providers** in `App.tsx` (deep nesting). `SubscriptionProvider` wraps entire app including storefront — subscription fetch runs for all authenticated routes.

### Maps, Sets, Caches

| Collection | File | Max Size | Eviction |
|------------|------|----------|----------|
| L1 cache | `lib/cache.ts` | **2,000 entries** | LRU + TTL + `pruneExpired()` every 5 min |
| Inflight dedup | `lib/cache.ts` | Per-request | Cleared on settle; `clearInflightAll()` on logout |
| Realtime hub | `merchantRealtimeHub.ts` | 1 entry/merchant tab | Teardown on idle/logout |
| Image load cache | `utils/imageLoadCache.ts` | **Unbounded Set** | ⚠️ Never pruned |
| Job queue persistence | `background/` | Disk-backed | Restored on startup |
| localMutationGuard | `localMutationGuard.ts` | Per owner/order | Lazy delete on read |

### Timers, Listeners, Workers

| Mechanism | Count (static scan) | Cleanup |
|-----------|---------------------|---------|
| `useEffect` | 172 | 57 explicit cleanups detected |
| `addEventListener` | 31 | 18 `removeEventListener` (gap: verify paired in effects) |
| `setInterval` | 8 | 9 `clearInterval` |
| `setTimeout` | 46 | 45 `clearTimeout` |
| `createObjectURL` | 8 | 9 `revokeObjectURL` ✅ |
| Background workers | 1 scheduler | Stops on `beforeunload` / visibility suspend |
| Web Workers | **0** | N/A |

**Memory lifecycle:** `installMemoryLifecycle()` in `main.tsx` — cache prune on visibility + 5-minute interval.

### Memory Leak Findings

| Finding | Severity | Details |
|---------|----------|---------|
| `imageLoadCache` unbounded Set | **Medium** | Grows with every unique image URL in long browsing sessions |
| Realtime multi-tab | Low | Connections, not heap leak (see Phase 5) |
| Job queue localStorage growth | Low | Persisted jobs; processed over time |
| Auth `TimeoutRegistry` | ✅ Fixed | Cleared on logout |
| Product image blob URLs | ✅ Fixed | `revokeObjectURL` in `ProductImagesManager` |
| Open static findings | **None** | `memory-leak-audit.mjs` reports 0 open issues |

### Estimated Heap (single tab, static model)

| Scenario | Idle | Peak |
|----------|------|------|
| Landing (cold) | ~35 MB | ~55 MB |
| Merchant dashboard | ~42 MB | ~78 MB |
| Products 1,000 SKUs | ~55 MB | ~120 MB |
| Statistics + charts open | ~60 MB | ~145 MB |
| Long session (4+ hr) | ~72 MB | ~210 MB |

---

## STEP 2 — React Rendering Audit

### Static Metrics (656 files)

| Pattern | Count | Assessment |
|---------|-------|------------|
| Components (.tsx) | 236 | — |
| `memo()` wrapped | **20** (~8.5%) | ⚠️ Low coverage |
| `useMemo` | 85 | Good on hot paths |
| `useCallback` | 116 | Good |
| `useContext` | 8 direct calls | Low — mostly custom hooks |
| Context `.Provider` | 18 | Deep tree |
| Inline arrow props in JSX | **304** | ⚠️ Child re-render risk |
| `.map()` in render | 372 | Expected for lists |

### Context Re-render Chain

```
AuthProvider (user, loading)
  └── SubscriptionProvider (depends on user — refetch on user.id)
        └── StoreProvider
              └── CartProvider (cart state changes — split mitigates)
                    └── StoreBootstrapProvider (hydrationVersion bumps)
```

**Risk:** `AuthProvider` value is `useMemo`'d but login/logout/profile updates re-render all descendants. `SubscriptionProvider` adds loading flicker on every auth change.

**Mitigations already in place:**
- Cart split into state vs actions contexts
- `DashboardOverview` wrapped in `memo`
- `StoreProductGrid`, `ProductCard`, `OptimizedImage`, `StatCard` memoized
- Store uses `useCartActions` only (not full cart state)

### Unnecessary Re-render Hotspots

| Location | Trigger | Impact |
|----------|---------|--------|
| `Statistics` + realtime | Every order event → full `refetch()` | **High** |
| `DashboardOverview` | `statsRefreshKey` bump on product/order events | Medium |
| `DashboardLayout` | No memo; children drive updates | Medium |
| `SubscriptionProvider` | Wraps storefront routes | Low–Medium |
| Inline handlers (304) | New function refs per render | Low (mostly leaf components) |

---

## STEP 3 — Component Cost

### Render Frequency × Cost Matrix

| Page / Component | Render Frequency | Est. Cost | Notes |
|------------------|------------------|-----------|-------|
| **Statistics** | Low mount; **high on realtime** | **Very High** | Multi-RPC fetch + `calculateStatistics` O(n) on orders/visits |
| **Products** (628 LOC) | Medium | High | 6× useMemo filters; progressive 48; DnD lazy |
| **Inventory** (771 LOC) | Medium | High | Progressive 48–100; integrity audits on mount |
| **Orders** (317 LOC) | Medium; realtime refetch | High | Full list refetch + notifications |
| **Store** (545 LOC) | High (filter/sort) | Medium–High | Client filter/sort on loaded page; paginated fetch |
| **Checkout** | High (form keystrokes) | Medium | Split cart; memo `DeliveryForm` |
| **ProductDetails** | Medium | High | Gallery images; 65 KB chunk |
| **DashboardOverview** | Medium (realtime) | Medium | memo ✅; 5 recent orders only |
| **Builder** | Low | Medium | — |
| **Admin*** | Low | Low–Medium | Lazy loaded |

### Expensive Pages (ranked)

1. **Statistics** — CPU-bound aggregation + Recharts lazy chunks
2. **Inventory** — largest dashboard chunk (64 KB gzip 18 KB)
3. **Products** — heavy filtering + optional DnD
4. **ProductDetails** — image gallery decode memory
5. **Orders** — realtime-driven refetch

---

## STEP 4 — Bundle Analysis

### Production Build — Largest Chunks (raw / gzip)

| Chunk | Raw KB | Gzip KB | Loaded When |
|-------|--------|---------|-------------|
| `vendor-charts` (recharts) | 409 | 110 | Statistics tab charts (lazy) |
| `index` (app shell) | 402 | 124 | **Initial** |
| `vendor-ui` (Radix subset) | 255 | 80 | **Initial** (providers) |
| `vendor-supabase` | 209 | 54 | **Initial** (auth) |
| `productFormUtils` | 143 | 44 | Add/Edit Product |
| `vendor-motion` (framer-motion) | 127 | 42 | Landing (`Index`) |
| `ProductDetails` | 65 | 23 | PDP route |
| `Inventory` | 64 | 18 | Inventory route |
| `vendor-validation` (zod) | 57 | 14 | Forms |
| `Checkout` | 42 | 14 | Checkout |
| `Orders` | 34 | 12 | Orders route |
| `Products` | 34 | 12 | Products route |
| `Statistics` | 28 | 10 | Statistics shell (charts separate) |
| `vendor-query` | 25 | 8 | **Initial** |
| `vendor-router` | 22 | 8 | **Initial** |

**Estimated initial JS (shell):** ~1.1 MB raw / **~330 KB gzip** (index + vendor-react* + router + ui + supabase + query)

\* vendor-react chunk emitted separately (~130 KB raw typical).

### Manual Chunks (`vite.config.ts`)

```
vendor-react, vendor-router, vendor-ui, vendor-charts,
vendor-query, vendor-supabase, vendor-motion, vendor-validation
```

✅ Good separation. Charts and motion excluded from critical path when routes lazy-load correctly.

### Dependency Usage Audit

| Package | Used? | Notes |
|---------|-------|-------|
| `recharts` | ✅ 2 components | Isolated in `vendor-charts` |
| `framer-motion` | ✅ 5 files (landing) | Isolated in `vendor-motion` |
| `@hello-pangea/dnd` | ✅ ProductsList | **React.lazy** import ✅ |
| `@tanstack/react-query` | ⚠️ Partial | Provider wired; merchant data mostly custom L1 cache |
| `date-fns` | ✅ Wide | Tree-shaken per import |
| `zod` | ✅ Forms | `vendor-validation` chunk |
| `embla-carousel` | ✅ Limited | — |
| Radix (14 packages) | ✅ Heavy | `vendor-ui` 255 KB — largest always-on cost |

### Dead Code / Duplicates

| Item | Status |
|------|--------|
| Duplicate packages | **None detected** (single lockfile) |
| React Query unused | ⚠️ Partially — infrastructure present, dashboard uses `lib/cache` |
| Background analytics processors | ⚠️ Registered but low traffic (Phase 4.4) |
| `lovable-tagger` | Dev only ✅ |

---

## STEP 5 — Lazy Loading Verification

| Area | Lazy? | Implementation |
|------|-------|----------------|
| **All routes** | ✅ | `React.lazy()` in `App.tsx` + `Suspense` |
| **Statistics charts** | ✅ | 8 sub-components lazy per tab |
| **DnD (Products)** | ✅ | `@hello-pangea/dnd` dynamic import |
| **Admin pages** | ✅ | Separate lazy chunks |
| **Landing** | ✅ | `Index` lazy |
| **Storefront** | ✅ | `Store`, `ProductDetails`, `Checkout` lazy |
| **Heavy dialogs** | ⚠️ Partial | Most inline with pages |
| **Marketing tabs** | ⚠️ | Loaded with `Marketing` route chunk (45 KB discounts tab) |
| **DashboardLayout** | ❌ | Eager within each page chunk |

**Verdict:** Route-level lazy loading is **excellent**. Sub-component lazy loading strong on Statistics; opportunity on Marketing/Settings tabs.

---

## STEP 6 — Images

### OptimizedImage (`components/OptimizedImage.tsx`)

| Feature | Status |
|---------|--------|
| `memo()` | ✅ |
| CDN variants (thumbnail/display) | ✅ |
| srcSet + sizes | ✅ |
| lazy loading default | ✅ |
| `decoding="async"` | ✅ |
| Blur placeholder | ✅ |
| Retry with cache-bust | ✅ |
| Thumbnail → full fallback | ✅ |

### Memory Risks

| Risk | Severity | Mitigation Today |
|------|----------|------------------|
| Decoded bitmaps in large grids | Medium | Progressive render limits DOM nodes |
| Gallery (ProductDetails) | Medium | Multiple eager/display variants |
| `imageLoadCache` Set growth | Medium | Tracks loaded URLs forever in tab |
| No explicit `img` unmount decode free | Low | Browser GC handles eventually |

**Large galleries:** ProductDetails + ProductsList grid — thumbnails use `variant="thumbnail"` ✅.

---

## STEP 7 — Virtualization

| Page | List Size | Strategy | True Virtualization? |
|------|-----------|----------|----------------------|
| Products | Up to full catalog in L1 | `useProgressiveRender(48)` | ❌ Slice only — all items in memory |
| Inventory | Full catalog mapped | Progressive 48–100 | ❌ |
| Store | Paginated RPC + visibleCount | Page size constant | ⚠️ Partial |
| Orders | Full fetched list | None | ❌ **Needs windowing at 500+ orders** |
| Statistics tables | Top-N | Small N | ✅ |

### Recommendations (do not implement)

- **Orders list:** `@tanstack/react-virtual` when >100 rows visible
- **Products grid:** Virtual grid at 500+ SKUs
- **Inventory table:** Virtual rows at 1,000+ lines

Current progressive render reduces **DOM nodes** but not **in-memory array size** (full catalog stays in L1).

---

## STEP 8 — CPU Analysis

### Heavy Operations

| Operation | Location | Complexity | When |
|-----------|----------|------------|------|
| `calculateStatistics` | `statisticsCalculator.ts` | O(orders + visits + items) | Statistics fetch/refetch |
| Product lifecycle filters | `Products.tsx` | O(n) × 6 memos | Filter/tab changes |
| Store client filter/sort | `Store.tsx` | O(n log n) sort | Filter changes |
| Inventory row mapping | `Inventory.tsx` | O(n) map | Catalog updates |
| Background worker poll | `JobScheduler.ts` | 150ms–2s interval | Always (merchant tab) |
| Realtime debounce flushes | Hub | Coalesced | Order/product events |

### Repeated Calculations

- **Statistics:** Full recalc on every realtime order — **primary CPU waste**
- **Products tab counts:** Recomputed via `useMemo` — acceptable
- **Dashboard insights:** Re-fetched on `statsRefreshKey` — acceptable

### Background CPU

- Worker polling suspended when tab hidden (`shouldSuspendWorkerPolling`)
- Realtime heartbeat skipped when hidden
- Cache prune skipped when hidden

---

## STEP 9 — Navigation Cost

| Navigation Type | Est. JS Download (gzip) | Est. Time (4G) | Data Fetch |
|-----------------|-------------------------|----------------|------------|
| **Cold /** (landing) | ~330 KB shell + ~6 KB Index | 1.5–2.5 s | Minimal |
| **Cold /login** | shell + ~3 KB | 1.5–2 s | Auth only |
| **Warm /builder** | ~22 KB Builder + ~19 KB DashboardLayout | 200–400 ms | Hydration RPC batch |
| **Warm /products** | ~12 KB | 150–300 ms | L1 cache hit → instant; miss → catalog RPC |
| **Warm /statistics** | ~10 KB + chart chunks on tab | 300–800 ms | Heavy multi-RPC |
| **Storefront cold** | shell + ~10 KB Store | 1–2 s | Edge/RPC catalog page |
| **Storefront warm** | 0 JS (route cached) | <100 ms | SWR cache |

**Cached navigation:** L1 hit → sub-50 ms paint (Products `syncFromCache`).  
**StoreBootstrap deferral:** Public routes skip merchant hydration ✅.

---

## STEP 10 — Scalability Estimates

### Product Catalog Size (single merchant, one tab)

| Products | L1 Memory | Filter CPU | DOM (progressive) | Verdict |
|----------|-----------|------------|-------------------|---------|
| 100 | ~2 MB | Trivial | 48 nodes | ✅ Excellent |
| 1,000 | ~15 MB | ~5–15 ms/filter | 48 nodes | ✅ Good |
| 10,000 | ~120 MB | ~50–150 ms/filter | 48 nodes | ⚠️ Memory + CPU |

### Concurrent Merchants (dashboard — client-side per user)

| Merchants | Impact | Bottleneck |
|-----------|--------|------------|
| 100 | None shared | — |
| 1,000 | None shared (isolated tabs) | Each user's own catalog size |
| 5,000 | Platform Realtime/DB | Server-side (Phase 5) |

*Frontend scales per-user, not per total merchant count.*

### Long Sessions (8+ hours)

| Factor | Behavior |
|--------|----------|
| L1 cache | Prune every 5 min; max 2000 keys |
| imageLoadCache | **Grows** — primary long-session risk |
| Service worker | Cache grows (prod) |
| Background jobs | Persisted queue may accumulate if failures |

---

## STEP 11 — Architecture Scores

| Category | Score | Rationale |
|----------|-------|-----------|
| **Memory** | 86/100 | LRU cache, lifecycle hooks, blob revoke; image Set unbounded |
| **CPU** | 82/100 | Adaptive workers; Statistics refetch heavy |
| **Bundle** | 78/100 | Good splitting; vendor-ui + index still large on boot |
| **Rendering** | 80/100 | Cart split + some memo; low global memo coverage |
| **Navigation** | 84/100 | Full route lazy + deferred hydration |
| **Overall Performance** | **82/100** | |

---

## Heavy Components (Summary)

| Component | Primary Cost |
|-----------|--------------|
| `Statistics` + `useRealStatistics` | RPC + O(n) aggregation + charts |
| `Products` | Filtering + large arrays in memory |
| `Inventory` | Row mapping + dual summaries |
| `Orders` | List render + realtime refetch |
| `ProductDetails` | Images + 65 KB chunk |
| `DashboardLayout` | Sidebar chrome on every dashboard page |
| `vendor-ui` | Always loaded Radix bundle |

---

## Memory Risks

| # | Risk | Severity | Long Sessions |
|---|------|----------|---------------|
| 1 | `imageLoadCache` unbounded | Medium | **Yes** |
| 2 | Full catalog in L1 (10k products) | High | Yes |
| 3 | Statistics `rawOrders` in state | Medium | Per visit |
| 4 | Job queue persistence growth | Low | Possible |
| 5 | 13 listener remove gaps (static) | Low | Review pairing |

---

## CPU Risks

| # | Risk | Trigger |
|---|------|---------|
| 1 | Statistics full refetch + calculate | Realtime order event |
| 2 | Products filter on 10k array | Tab/search change |
| 3 | Store sort/filter | User interaction |
| 4 | Background worker active poll | Pending cache jobs |
| 5 | Recharts render | Statistics chart tabs |

---

## Performance Score Summary

**Overall: 82 / 100** — Enterprise-capable with known hotspots at large catalog sizes and Statistics realtime path.

---

## Priority Matrix

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Cap or LRU `imageLoadCache` | Low | Long-session memory |
| **P1** | Statistics incremental update (not full refetch) | Medium | CPU + network |
| **P1** | Virtualize Orders list (500+ rows) | Medium | DOM + render |
| **P2** | Raise Products memo coverage / split DashboardLayout | Medium | Render |
| **P2** | Lazy-load Marketing sub-tabs | Low | Bundle |
| **P2** | Paginate or shard L1 product cache at 2k+ SKUs | High | Memory |
| **P3** | Move SubscriptionProvider inside dashboard routes only | Medium | Storefront render |
| **P3** | Wire React Query for merchant lists (or document L1-only) | High | Architecture clarity |

---

## Quick Wins (Recommendations Only)

1. **Cap `imageLoadCache`** at ~500 URLs with FIFO eviction
2. **Statistics:** bump cache key instead of full `refetch()` on realtime (mirror Dashboard)
3. **Lazy-load** `ProductDiscountsTab` / marketing tabs individually
4. **Memo `DashboardLayout`** or extract static sidebar
5. **Orders page:** paginate server-side (if not already at high counts)
6. **Defer `vendor-ui`** — audit which Radix primitives needed on landing vs dashboard

---

## Long-Term Improvements

| Improvement | Benefit |
|-------------|---------|
| True list virtualization (Products, Orders, Inventory) | DOM + render at 1k–10k rows |
| Web Worker for `calculateStatistics` | Off main thread |
| IndexedDB tier for large product catalogs | Bound heap |
| Route-based provider splitting | Reduce storefront context overhead |
| Bundle analyzer CI gate | Prevent chunk regression |
| React Query migration for merchant lists | Unified cache + invalidation |
| Image decode pool / limit concurrent decodes | GPU memory on galleries |

---

## Roadmap

| Phase | Focus | Duration |
|-------|-------|----------|
| **6.1** | Memory caps (`imageLoadCache`, catalog L1 policy) | 1–2 days |
| **6.2** | Statistics + realtime CPU path | 2–3 days |
| **6.3** | Orders/Products virtualization | 3–5 days |
| **6.4** | Bundle diet (vendor-ui audit, marketing lazy tabs) | 2–3 days |
| **6.5** | Load test — 1k products, 4hr session, heap snapshot | 2 days |

---

## Problems Found

1. **Low memo coverage** — 20/236 components (~8.5%)
2. **304 inline JSX arrow handlers** — unnecessary child invalidation
3. **`imageLoadCache` never pruned** — long-session memory growth
4. **Full catalog held in L1** — progressive render only limits DOM, not heap
5. **Statistics realtime full refetch** — heaviest CPU/network loop
6. **Orders list not virtualized** — scales poorly beyond ~500 visible orders
7. **Deep provider tree** — Subscription wraps storefront unnecessarily
8. **React Query underutilized** — duplicate caching mental model (L1 vs RQ)
9. **DashboardLayout not memoized** — re-renders with page state
10. **vendor-ui 255 KB always loaded** — largest fixed boot cost after index

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 10k product merchant OOM slow tab | Medium | High | Catalog pagination + IDB tier |
| Long session image cache bloat | Medium | Medium | Cap Set size |
| Statistics during order rush | Low | High | Incremental stats |
| Large initial bundle on 3G | Medium | Medium | Further vendor-ui deferral |
| Mobile gallery memory kill | Low | High | Limit concurrent full-res images |

---

## Verification Performed

| Check | Result |
|-------|--------|
| Production build | ✅ 27.8s, chunks analyzed |
| `frontend-render-audit.mjs` | ✅ 656 files; render score 82 |
| `memory-leak-audit.mjs` | ✅ 0 open findings; score 86 |
| Route lazy loading | ✅ All pages in `App.tsx` |
| Cart context split | ✅ Verified |
| Cache LRU + prune | ✅ `MAX_CACHE_ENTRIES=2000` |
| Progressive render | ✅ Products, Inventory |
| Service worker | ✅ Prod only |

---

**End of Phase 6 Audit — analysis only, no implementation.**
