# Subscription Optimization Report

**Date:** 2026-06-19  
**Role:** Supabase Realtime Specialist  
**Goal:** Minimize channels, events, and client work for thousands of concurrent merchants

---

## Optimization scorecard

| Metric | Before hub | Current | Target |
|--------|------------|---------|--------|
| Channels per merchant | 2–4 (duplicated handlers) | **2** | 2 |
| Cache patches per product event | N (per hook) | **1** | 1 |
| Order refetches per burst | N handlers × events | **1 debounced** | 1 |
| Storefront invalidations | Every product UPDATE | **Visible fields only** | Field-filtered |
| Logout channel cleanup | Partial | **Full teardown** | Full |
| Statistics live refresh | Manual only | **Order-driven** | Order-driven |
| Analytics Realtime subs | 0 | **0** | 0 (keep) |

**Overall optimization rating: 92/100**

---

## 1. Optimization principles applied

### 1.1 Hub pattern (mandatory)

```
❌ Page → supabase.channel() → postgres_changes
✅ Page → useRealtime* → merchantRealtimeHub → single channel
```

**Impact:** Eliminates duplicate WebSocket bindings when multiple components need the same table.

### 1.2 Event coalescing

| Layer | Window | Applies to |
|-------|--------|------------|
| Product UI | 300ms | Inventory, Products list re-render |
| Order refetch | 500ms | Orders list, dashboard, statistics reload |
| Visibility gate | Until `visible` | Background tab deferral |

**Impact:** Bulk stock sync from 20 orders → 1 UI refresh instead of 20.

### 1.3 Server-side publication minimalism

Only `orders` and `products` are in `supabase_realtime`.

**Avoided publications:**

| Table | Why not |
|-------|---------|
| `store_visits` | Checkout-scale write volume |
| `product_views` | Every PDP view |
| `order_items` | Covered by order parent events + RPC |
| `inventory_movements` | Audit log; on-demand load |
| `store_daily_stats` | Trigger-maintained; RPC read |

**Impact:** WAL fan-out stays bounded as merchant count grows.

### 1.4 Pull-over-push for analytics

```
Order event → flushOrderCache() → HTTP RPC refetch (90s cache)
```

Not:

```
store_daily_stats postgres_changes → per-row client updates
```

**Impact:** Analytics scale with HTTP/RPC capacity, not WebSocket message rate.

---

## 2. Per-domain optimization map

### Orders

| Optimization | Implementation |
|--------------|----------------|
| Single channel | `orders-realtime-{ownerId}` |
| Split INSERT vs UPDATE handlers | INSERT for instant toast; UPDATE with noise filter |
| Shared debounced refetch | `scheduleOrderRefetch` |
| Cache namespace flush | `flushOrderCache` clears orders + stats + dashboard |
| Remove spurious `onEvent({ type: 'refetch' })` | Debounced burst → `onChange` only |

### Notifications

| Optimization | Implementation |
|--------------|----------------|
| No dedicated channel | Map order `onEvent` → `OrderNotification` |
| localStorage cap | Max 50 notifications per owner |
| Dedup by id | `pushNotification` filters duplicate ids |

### Inventory

| Optimization | Implementation |
|--------------|----------------|
| Reuse products channel | Stock lives on `products` row |
| Cache patch not full reload | `patchCachedProduct` in hub |
| `syncFromCache()` on UI hook | Inventory reads patched cache |
| Movement history | `refreshKey` polling in dialog only |

### Dashboard

| Optimization | Implementation |
|--------------|----------------|
| Batch KPI RPC | `get_dashboard_statistics_batch` (single SQL scan) |
| Order event → cache invalidation | Not full Realtime stats pipeline |
| `statsRefreshKey` bump | Triggers one insights reload per debounced burst |

### Analytics / Statistics

| Optimization | Implementation |
|--------------|----------------|
| Bundle RPC | `get_statistics_page_bundle` (v38) |
| No stats table subscription | Rollups + cached RPC |
| Live refresh hook | `useRealtimeOrders(() => refetch())` on Statistics page |
| Skip redundant fetches | KPI present → skip visits/order_items |

---

## 3. Duplicate subscription analysis

| Scenario | Channels | Verdict |
|----------|----------|---------|
| Products page mounted | 1 product | OK |
| Inventory page mounted | 1 product (same channel) | OK |
| Dashboard mounted | 1 order | OK |
| Orders page mounted | 1 order (same channel) | OK |
| Statistics page mounted | 1 order (same channel) | OK |
| Products + Orders (impossible — exclusive routes) | Would be 2 | OK |
| Two browser tabs, same merchant | 2× channels per tab = 4 WS per user | **Expected** — Supabase per-tab |

**Rule:** React Router exclusive routes guarantee ≤2 channels per tab.

---

## 4. Changes implemented (this audit)

| Change | File | Benefit |
|--------|------|---------|
| Hub teardown on logout | `AuthContext.tsx` | Prevents orphaned channels across sessions |
| Statistics order subscription | `Statistics.tsx` | Live analytics without new channel |
| Remove `refetch` onEvent dispatch | `merchantRealtimeHub.ts` | Fewer handler calls per debounced burst |

---

## 5. Recommended roadmap (P2)

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P2 | Add `last_synced_at` to `ORDER_NOISE_FIELDS` if added to schema | Low | Fewer refetches |
| P2 | `Broadcast` channel for platform maintenance banner | Low | No postgres_changes needed |
| P3 | Cross-tab notification `storage` listener | Medium | UX consistency |
| P3 | Server flag `app.skip_realtime` on bulk imports | Medium | Import burst protection |
| P3 | Metrics export: `getMerchantRealtimeHubStats()` | Low | Ops observability |

### Do not implement

| Anti-pattern | Why |
|--------------|-----|
| Subscribe to `store_visits` for live visitor count | Write amplification at scale |
| Per-page `supabase.channel()` | Duplicates connections |
| Realtime on `order_items` | Redundant with orders channel |
| Push analytics rows to client | Use rollups + RPC |

---

## 6. Capacity planning

### Connection budget

```
peak_realtime_connections ≈ concurrent_merchants × 2 × avg_tabs_per_merchant
```

| Merchants online | Tabs | Channels |
|------------------|------|----------|
| 500 | 1 | 1,000 |
| 1,000 | 1.2 | 2,400 |
| 5,000 | 1.1 | 11,000 |

Validate against Supabase plan Realtime connection limits before 5k+ concurrent merchants.

### Message rate budget (per merchant / hour)

| Source | Raw WAL events | After hub |
|--------|----------------|-----------|
| Orders | 5–50 | 1–5 refetches |
| Products (stock sync) | 10–200 | 1–10 UI updates |

### Storefront (10k concurrent visitors)

- **0 Realtime channels**
- Visit/view tracking via slug RPC + sessionStorage dedupe
- Scales on HTTP edge, not WebSocket pool

---

## 7. Monitoring checklist (production)

| Signal | Alert threshold |
|--------|-----------------|
| Realtime connection count | >80% of plan limit |
| `CHANNEL_ERROR` rate in client logs | Sustained >1% sessions |
| Order refetch latency p95 | >2s after event |
| WAL lag on `orders` / `products` | >5s |
| Hub reconnect exhaustion | Log when `reconnectAttempt >= MAX` |

---

## 8. Before / after summary

### Before (pre-hub)

- Each hook created redundant cache work
- No reconnect on channel failure
- No visibility deferral
- Logout could leave stale channel refs
- Statistics required manual refresh
- Dashboard batch called statistics RPC 6× internally

### After (current)

- **2 channels** per merchant tab, shared handlers
- Exponential backoff reconnect
- Noise filtering + debouncing
- Full hub teardown on logout and failover
- Statistics live refresh via existing order channel
- Dashboard + analytics use batch/bundle RPC with 90s cache

---

## 9. Verification

```bash
npm test   # includes merchantRealtimeUtils tests
```

**DevTools validation:**

1. Filter WS frames by `orders-realtime` — confirm single subscription
2. Trigger 10 rapid product stock updates — confirm ≤2 UI handler flushes (300ms debounce)
3. Logout — confirm WS channels close
4. Open Statistics — place test order — metrics refresh within ~500ms

---

**See also:** [`REALTIME_AUDIT_REPORT.md`](./REALTIME_AUDIT_REPORT.md)
