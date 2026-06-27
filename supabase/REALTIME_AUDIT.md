# Supabase Realtime Audit

**Date:** 2026-06-19  
**Scope:** All merchant `postgres_changes` subscriptions (`products`, `orders`)

> **Full reports:** [`REALTIME_AUDIT_REPORT.md`](./REALTIME_AUDIT_REPORT.md) · [`SUBSCRIPTION_OPTIMIZATION_REPORT.md`](./SUBSCRIPTION_OPTIMIZATION_REPORT.md)

---

## Architecture (after optimization)

```
┌─────────────────────────────────────────────────────────────┐
│  merchantRealtimeHub.ts — singleton per owner_id            │
│  ├─ products-realtime-{userId}  (1 channel, N UI handlers)  │
│  └─ orders-realtime-{userId}    (1 channel, N listeners)    │
└─────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │                              │
 useRealtimeProducts              useRealtimeOrders
 (Products, Inventory)           (Builder dashboard, Orders)
```

**Tenant isolation:** All filters use `owner_id=eq.{userId}`. Public storefront does not open Realtime channels.

**DB publication:** `orders` and `products` are in `supabase_realtime` (migrations v02–v05).

---

## Findings

### Duplicate subscriptions — mitigated

| Before | After |
|--------|-------|
| Each `useRealtimeProducts` instance ran full cache patch + storefront invalidation | Hub patches cache **once**; hooks only register UI callbacks |
| Multiple pages could stack handlers on the same channel | Still one channel, but work is no longer duplicated |
| Routes are exclusive (Builder / Products / Inventory / Orders) | Only one page mounts at a time — max 1 product + 1 order hook |

**Not duplicated:** Auth `onAuthStateChange` in `AuthContext` (session only, not Postgres Realtime).

### Memory leaks — fixed

| Issue | Fix |
|-------|-----|
| `resetSupabaseClient()` left stale channel refs on old client | `teardownMerchantRealtimeHub()` clears channels, timers, and maps |
| Debounce timers on unmount | Cleared when last handler unsubscribes |
| Reconnect timers | Cleared on teardown and channel removal |

### Unnecessary updates — reduced

| Source | Optimization |
|--------|--------------|
| Product `UPDATE` with only `updated_at` | Ignored (`PRODUCT_NOISE_FIELDS`) |
| Order `UPDATE` with only `updated_at` | Ignored (`ORDER_NOISE_FIELDS`) |
| Storefront invalidation | Only when storefront-visible columns change |
| Product UI refresh | 300ms debounce **shared** across all UI handlers |
| Order list refetch | 500ms debounce; skips while tab is hidden |
| Hidden tab | Refetch/UI notify deferred until `visibilitychange` |

### Reconnection — improved

| Before | After |
|--------|-------|
| `.subscribe()` with no status handling | Status callback on `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED` |
| Silent failure after network drop | Exponential backoff reconnect (max 6 attempts, up to 30s) |
| Failover client swap | Hub teardown + full page reload (RecoveryBanner) |

---

## Subscription inventory

| Channel | Table | Events | Used by |
|---------|-------|--------|---------|
| `products-realtime-{ownerId}` | `products` | `*` | Products, Inventory |
| `orders-realtime-{ownerId}` | `orders` | `INSERT`, `UPDATE` | Builder dashboard, Orders |

**Not realtime (by design):** Statistics, customers, inventory movements, product views — fetched via RPC/polling.

---

## Large-scale guidance

1. **Keep hub pattern** — never call `supabase.channel()` from page components directly.
2. **Filter at handler** — extend `PRODUCT_NOISE_FIELDS` / `ORDER_NOISE_FIELDS` before adding DB triggers that touch rows often.
3. **Cap concurrent merchants** — each logged-in merchant holds 2 Realtime channels; scale Realtime connection limits accordingly.
4. **Prefer rollups** for analytics — already implemented; avoids subscribing to high-churn tables.
5. **Bulk operations** — bulk product import triggers many events; debouncing prevents UI thrash.

---

## Files changed

- `src/lib/merchantRealtimeHub.ts` — hub rewrite (cache centralization, reconnect, visibility)
- `src/lib/merchantRealtimeUtils.ts` — noise detection + storefront field filter
- `src/hooks/useRealtimeProducts.tsx` — lightweight UI-only hook (stable deps)
- `src/lib/disasterRecovery/supabaseClient.ts` — teardown on client reset
- `src/lib/merchantRealtimeUtils.test.ts` — unit tests

---

## Verification

```bash
npm test
```

Manual: open Builder + Orders in sequence, confirm single WebSocket channel pair in DevTools; edit order status and product stock and confirm debounced refresh.
