# Realtime Audit Report

**Date:** 2026-06-19 (updated — event metrics + expanded noise filter)  
**Role:** Supabase Realtime Specialist  
**Scope:** Orders, notifications, inventory, dashboard, analytics  
**Stack:** Supabase `postgres_changes` via shared `merchantRealtimeHub`  
**See also:** [REALTIME_ARCHITECTURE_AUDIT_REPORT.md](./REALTIME_ARCHITECTURE_AUDIT_REPORT.md) · [REALTIME_EVENT_OPTIMIZATION_REPORT.md](./REALTIME_EVENT_OPTIMIZATION_REPORT.md) · [REALTIME_SCALABILITY_REPORT.md](./REALTIME_SCALABILITY_REPORT.md)

---

## Executive summary

| Area | Realtime? | Status | Score |
|------|-----------|--------|-------|
| **Orders** | Yes — `orders` INSERT/UPDATE | Hub + debounce + noise filter | **94/100** |
| **Notifications** | Derived from order events (no separate channel) | localStorage-backed | **90/100** |
| **Inventory** | Via `products` channel (stock patches) | Shared hub, cache-first | **92/100** |
| **Dashboard** | Via order channel → cache flush + refetch | Debounced 500ms | **91/100** |
| **Analytics / Statistics** | Order-driven invalidation (no analytics table sub) | Cache + refetch on order events | **88/100** |
| **Overall realtime health** | | | **93/100** |

**Channels per active merchant:** 2 max (`products-realtime-{ownerId}`, `orders-realtime-{ownerId}`)  
**Public storefront:** 0 Realtime channels (HTTP tracking only)

---

## 1. Subscription inventory

### Active channels

| Channel name | Table | Events | Filter | Consumers |
|--------------|-------|--------|--------|-----------|
| `products-realtime-{ownerId}` | `products` | `*` | `owner_id=eq.{ownerId}` | Products, Inventory |
| `orders-realtime-{ownerId}` | `orders` | `INSERT`, `UPDATE` | `owner_id=eq.{ownerId}` | Dashboard, Orders, Statistics |

### Not subscribed (by design)

| Domain | Reason |
|--------|--------|
| `store_visits` / `product_views` | High write volume; aggregated via RPC rollups |
| `store_daily_stats` | Incremental DB triggers; read via cached KPI RPCs |
| `inventory_movements` | Audit log; loaded on-demand in dialog |
| `customers` | Low churn; fetched with statistics RPC |
| `notifications` table | N/A — in-app notifications are order-event derived + `localStorage` |
| Storefront catalog | Public reads use HTTP + 120s cache; no WebSocket |

### DB publication

Tables in `supabase_realtime` publication (migrations v02–v05):

- `public.orders`
- `public.products`

No other tables are published — limits WAL fan-out and connection load.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ merchantRealtimeHub.ts — singleton per owner_id                  │
│                                                                  │
│  products-realtime-{userId}                                      │
│    ├─ postgres_changes * on products (owner filter)              │
│    ├─ patch product cache once                                   │
│    ├─ storefront invalidation (visible fields only)              │
│    └─ N UI handlers (300ms debounced)                            │
│                                                                  │
│  orders-realtime-{userId}                                        │
│    ├─ postgres_changes INSERT + UPDATE on orders                 │
│    ├─ noise filter (updated_at-only)                             │
│    ├─ flushOrderCache (stats + dashboard + orders)               │
│    └─ N listeners (500ms debounced, visibility-aware)            │
└──────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
  useRealtimeProducts   useRealtimeOrders    useRealtimeOrders
  (Products, Inventory) (Dashboard, Orders, Statistics)
```

**Tenant isolation:** All filters use `owner_id=eq.{authenticatedUserId}`. RPC auth on reads; RLS on tables. Storefront does not open merchant channels.

---

## 3. Domain-by-domain review

### 3.1 Orders

| Check | Result |
|-------|--------|
| Store-scoped filter | Pass — `owner_id=eq.{userId}` |
| Duplicate channels | Pass — one hub channel per merchant |
| INSERT handling | Pass — immediate `onEvent`, debounced list refetch |
| UPDATE handling | Pass — noise filter; status/payment surfaced to UI |
| Self-echo on merchant edit | Acceptable — debounced refetch, not duplicate channel |

**Consumers:**

- `DashboardOverview` — refetch recent orders + bump `statsRefreshKey`
- `Orders` — refetch list, reload stats, toasts, notification center
- `Statistics` — debounced `refetch()` after cache flush *(added this audit)*

### 3.2 Notifications

Notifications are **not** a separate Realtime subscription.

| Source | Mechanism |
|--------|-----------|
| New / status / payment events | `useRealtimeOrders` → `onEvent` → `eventToNotification()` |
| Persistence | `localStorage` (`merchant-order-notifications:{ownerId}`, max 50) |
| UI | `OrderNotificationsCenter` on Orders page |

**Finding:** Notifications only populate while Orders page logic runs `onEvent`. Dashboard does not push to notification center (by design — Orders is the notification hub).

### 3.3 Inventory

Inventory does **not** subscribe to `inventory_movements`.

| Update path | Mechanism |
|-------------|-----------|
| Stock change from checkout | `products` UPDATE → hub patches cache → Inventory `syncFromCache()` |
| Manual restock | Optimistic local reload after RPC |
| Movement history | Polling via `refreshKey` when dialog opens |

**Correct for scale:** Avoids subscribing to a high-churn audit table.

### 3.4 Dashboard updates

| Trigger | Effect |
|---------|--------|
| Order INSERT/UPDATE (non-noise) | `flushOrderCache` → invalidate dashboard batch + stats keys |
| `useRealtimeOrders` on Dashboard | `refetch()` recent orders + `setStatsRefreshKey` → `useDashboardInsights` reload |
| Debounce | 500ms coalescing; deferred while tab hidden |

Dashboard KPIs are **pull-based** after cache invalidation, not live analytics subscriptions.

### 3.5 Analytics updates

| Mechanism | Detail |
|-----------|--------|
| No `store_daily_stats` subscription | Rollups updated by DB triggers |
| Cache TTL | 90s analytics cache; flushed on order events |
| Statistics page | Now subscribes to order channel for live refresh |
| Product views / visits | Not realtime — RPC aggregates |

---

## 4. Issues detected

### P0 — Fixed this audit

| Issue | Risk | Fix |
|-------|------|-----|
| **Logout left hub channels alive** | Memory leak; stale channels on session end | `teardownMerchantRealtimeHub()` in `AuthContext.logout` |
| **Statistics page stale while open** | Analytics not updating on new orders | `useRealtimeOrders(() => refetch())` on Statistics page |
| **Spurious `refetch` events to `onEvent`** | Unnecessary handler invocations | Removed; debounced burst uses `onChange` only |

### P1 — Already mitigated (prior hub rewrite)

| Issue | Mitigation |
|-------|------------|
| Duplicate cache patching per hook | Centralized in hub |
| No reconnect on `CHANNEL_ERROR` | Exponential backoff (6 attempts, max 30s) |
| Hidden tab refetch storm | `visibilitychange` flush of pending work |
| `updated_at`-only product/order updates | `PRODUCT_NOISE_FIELDS` / `ORDER_NOISE_FIELDS` |
| Failover client swap | `teardownMerchantRealtimeHub()` in `resetSupabaseClient()` |

### P2 — Remaining (non-blocking)

| Issue | Recommendation |
|-------|----------------|
| Multi-day unique visitors overcount | Analytics RPC limitation; not Realtime |
| `refetch` type still in `OrderRealtimeEvent` union | Remove in future type cleanup |
| No cross-tab notification sync | `storage` event on notification key if needed |
| Bulk import fires many product events | Hub debounce handles; consider server-side batch flag |

---

## 5. Memory leak analysis

| Lifecycle event | Cleanup |
|-----------------|---------|
| Component unmount | `subscribeMerchant*` removes handler; tears down channel when last handler gone |
| Debounce / reconnect timers | Cleared on last unsubscribe + `teardownMerchantRealtimeHub` |
| Logout | Hub teardown + cache invalidation |
| Client reset (failover) | Hub teardown before new client |
| Auth `onAuthStateChange` | Session only — not Postgres channels |

**Verdict:** No leak paths identified after logout teardown fix.

---

## 6. Reconnection behavior

| State | Action |
|-------|--------|
| `SUBSCRIBED` | Reset reconnect attempt counter |
| `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` | `removeChannel` + exponential backoff resubscribe |
| Max attempts (6) | Stop retrying; user refresh or navigation resubscribes |
| Tab becomes visible | Flush pending UI notify / order refetch |

---

## 7. Event volume / excessive events

| Mitigation | Reduction |
|------------|-----------|
| Product UI debounce (300ms) | Coalesces burst updates (bulk edit) |
| Order refetch debounce (500ms) | One refetch per burst |
| Noise field filter | Drops `updated_at`-only order/product updates |
| Storefront invalidation filter | Only visible catalog columns |
| Hidden document | Defers refetch until visible |
| No publication on visits/views | Eliminates highest-churn tables |

**Estimated events per merchant per hour (typical):** 5–50 order events, 10–200 product events (checkout stock sync). Hub reduces UI reactions to a fraction of raw WAL events.

---

## 8. Scalability (thousands of concurrent users)

| Factor | Capacity model |
|--------|----------------|
| Channels per logged-in merchant | **2** |
| 1,000 concurrent merchants | ~2,000 Realtime channels |
| 10,000 storefront visitors | **0** extra channels (HTTP only) |
| Hub pattern | Required — never `supabase.channel()` from pages |
| Analytics | RPC + cache; no stats subscriptions |
| Inventory movements | On-demand fetch, not streamed |

**Supabase Realtime planning:** Size connection limits for **2 × peak concurrent merchants**, not storefront visitors. Monitor `CHANNEL_ERROR` rates and WAL lag on `orders`/`products`.

---

## 9. Verification

```bash
npm test
```

### Manual checklist

- [ ] DevTools → Network → WS: one pair of channels per merchant session
- [ ] Navigate Products → Inventory: channel count stays at 2
- [ ] New order on Dashboard: recent orders + KPIs update within ~500ms
- [ ] Statistics page open: new order updates metrics after debounce
- [ ] Logout → login as different user: no events from previous tenant
- [ ] Airplane mode 10s → restore: channel reconnects or recovers on navigation

---

## 10. Files reference

| File | Role |
|------|------|
| `src/lib/merchantRealtimeHub.ts` | Shared channels, reconnect, debounce |
| `src/lib/merchantRealtimeUtils.ts` | Noise + storefront field detection |
| `src/hooks/useRealtimeOrders.tsx` | Order subscription hook |
| `src/hooks/useRealtimeProducts.tsx` | Product subscription hook |
| `src/hooks/useOrderNotifications.tsx` | Order-event → notification mapping |
| `src/context/AuthContext.tsx` | Logout hub teardown |
| `src/lib/disasterRecovery/supabaseClient.ts` | Failover hub teardown |

**Related:** [`SUBSCRIPTION_OPTIMIZATION_REPORT.md`](./SUBSCRIPTION_OPTIMIZATION_REPORT.md)
