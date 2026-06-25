# React Performance Audit

**Date:** 2026-06-19  
**Scope:** Dashboard, Orders, Products, Inventory, Statistics

## Issues found & fixes applied

### Dashboard

| Issue | Fix |
|-------|-----|
| Realtime triggered duplicate stats fetch (`useOrderDashboardStats` + batch in insights) | Derive `pendingFulfillment` from shared `fetchDashboardStatisticsBatch` |
| `getProductsSync()` on every render | Wrapped in `useMemo` keyed by `refreshKey` |
| Slug check refetched on every realtime tick | Slug fetch only on `user.id` change |
| Missing `supabase` import in RPC fallback | Added import |

### Orders

| Issue | Fix |
|-------|-----|
| Tab counts refetched on every page change | Split `loadTabCounts` — runs on filter change only |
| Sequential bulk status updates (N+1) | `runWithConcurrency(..., 5)` |
| Double debounce (hub 500ms + page 400ms) | Removed page-level timer; hub debounce only |
| `flushOwnerCache` typo / missing import | Fixed; optimistic update without full page reload on single status change |
| Tab focus refetch storm | 60s throttle on `visibilitychange` |
| Duplicate stats RPC | `useOrderDashboardStats` prefers cached dashboard batch |

### Products

| Issue | Fix |
|-------|-----|
| `FooterSuggestedProductsManager` force-loaded entire catalog on mount | Uses `getProductsSync()`; full load only when picker dialog opens |
| Sequential bulk publish/archive | `runWithConcurrency(..., 4)` |

### Inventory

| Issue | Fix |
|-------|-----|
| Server + client double search/category filter | Hook loads full catalog (`''`, `'all'`); filters client-side only |
| Extra state copy via `useEffect` | `useMemo` from `catalog.products` |
| Realtime full reload | `catalog.syncFromCache()` only |

### Analytics / Statistics

| Issue | Fix |
|-------|-----|
| `fetchOrderItemsForStatistics` waterfall after parallel block | Included in initial `Promise.all` |

### Shared

| Issue | Fix |
|-------|-----|
| Product realtime storm on bulk import | Debounced parent `onUpdate` (300ms) in `useRealtimeProducts` |
| New utility | `src/utils/runWithConcurrency.ts` for bounded parallel mutations |

---

## Remaining recommendations (P2)

1. **Statistics tabs** — lazy-fetch data per tab instead of upfront 15k-row load
2. **Products hybrid filters** — pick server-only or client-only filtering (avoid double-pass on lifecycle/stock)
3. **True virtualization** — `@tanstack/react-virtual` when catalogs exceed 200 rows
4. **Dashboard batch** — single refresh callback (recent orders + batch share one debounced timer)
5. **Inventory stats** — server aggregate when `hasMore` is true (partial page totals)

---

## Verification

- Open Dashboard → DevTools Network: one batch RPC on load, not duplicate stats summary
- Orders → change page: list RPC only, no workflow tab count RPC
- Products mount → no `loadAllMerchantProducts(true)` until footer picker opens
- Inventory search → single filter pass, no duplicate server query
- Statistics load → order items fetch parallel with orders/visits

```bash
npm test
```
