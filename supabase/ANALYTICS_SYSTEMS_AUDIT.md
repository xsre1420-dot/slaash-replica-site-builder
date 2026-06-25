# Analytics Systems Audit

**Date:** 2026-06-19  
**Scope:** Revenue, orders statistics, visitor tracking, product analytics, customer analytics  
**Tenant model:** All merchant analytics are **`owner_id`-scoped** (one store per authenticated merchant). Public storefront tracking uses **`store_slug`** resolved server-side to `owner_id`.

---

## Executive summary

| Area | Store-specific? | Accuracy | Caching / aggregation |
|------|-----------------|----------|------------------------|
| Revenue (RPC rollups) | Yes (`owner_id`) | Fixed: net = `completed_revenue - refund_total` | `store_daily_stats` + v30 amount-edit trigger |
| Revenue (Dashboard / Statistics UI) | Yes | Fixed: shared `netRevenueFromRpc`, chart excludes refunded | 90s KPI cache when RPC ready |
| Orders statistics | Yes | KPI from RPC; client fallback excludes cancelled/refunded | Rollups + capped chart fetches |
| Visitor tracking | Yes (slug → owner) | Deduped writes; unique visitors via RPC | Client 30min dedupe; DB daily rollups |
| Product analytics | Yes | Views + top sellers from RPC / order_items | KPI in RPC; items capped at 5000 |
| Customer analytics | Yes | RPC uses `first_order_date` / `last_order_date`; client enriches missing KPIs | Same statistics cache |

**Deploy:** Run `npm run db:deploy` to apply migration **v30** (`20260625000020_analytics_accuracy.sql`).

---

## 1. Revenue calculations

### Source of truth (database)

- **`get_store_statistics(p_owner_id, start, end)`** aggregates from `store_daily_stats` when rollups exist, else scans `orders`.
- **`completed_revenue`**: sum of `total_amount` for `status = 'completed'`.
- **`refund_total`**: sum of refunded amounts in period (payment/refund workflow).
- **Net revenue** (display): `GREATEST(0, completed_revenue - refund_total)`.

### Rollup maintenance (v30)

Previously, editing `total_amount` on an already-completed order did not adjust `store_daily_stats`. Migration v30 extends `trg_orders_daily_stats` to apply a revenue delta when status stays `completed` but amount changes.

### Client alignment

| File | Change |
|------|--------|
| `src/utils/analyticsMetrics.ts` | `netRevenueFromRpc()` — single net-revenue helper |
| `src/utils/dashboardInsightsUtils.ts` | Dashboard period KPIs use net revenue |
| `src/services/dashboardStatsService.ts` | All-time dashboard stats use net revenue; 90s cache TTL |
| `src/utils/statisticsCalculator.ts` | KPI net revenue; client fallback excludes `payment_status = 'refunded'` |
| `src/components/statistics/SalesChart.tsx` | Chart bars exclude refunded completed orders |

---

## 2. Orders statistics

### KPI path (preferred)

When `get_store_statistics` returns usable KPIs:

- **Order count:** non-cancelled orders in range (`order_count`).
- **Completed count:** `completed_order_count` (conversion rate denominator).
- **Charts / breakdowns:** load only current-period orders (cap 5000) with `payment_status` for refund filtering.

### Fallback path

If RPC unavailable or returns empty KPIs:

- Fetch up to 5000 orders from `previousStart` through period end.
- Client computes metrics in `calculateStatistics()` with same net-revenue rules.

### Cache invalidation

- `flushOrderCache(ownerId)` — called on order mutations; clears orders list, dashboard batch, and all `stats:{ownerId}:*` keys.
- `invalidateMerchantAnalyticsCache(ownerId)` — explicit analytics-only flush (statistics + dashboard batch).
- `invalidateStatisticsCache(ownerId, range)` — single date-range entry.

---

## 3. Visitor tracking

### Storefront (public)

- **`useStoreVisitTracking`**: calls `track_store_visit_by_slug` with normalized slug.
- **Deduping:** 30-minute sessionStorage per path (and per slug on home) to limit write amplification.
- **Deferred:** `requestIdleCallback` / timeout so tracking does not block paint.

### Merchant analytics

- **`get_store_statistics`**: `visit_count`, `unique_visitors` from `store_visits` / rollups.
- When KPI RPC succeeds for both current and previous periods, visit rows are skipped (previous KPI used for growth).

### Store-specific guarantee

Slug RPC resolves to a single `owner_id` server-side; visits are never attributed across merchants.

---

## 4. Product analytics

| Metric | Source |
|--------|--------|
| Top sellers (revenue / units) | `order_items` joined to completed orders in period |
| Top viewed products | RPC `top_viewed_products` from `product_views` rollups |
| Product count | RPC `product_count` or live count fallback |

**Cap:** `get_order_items_for_statistics` limited to 5000 rows; UI shows truncation warning when caps hit.

---

## 5. Customer analytics

### RPC semantics (correct)

- **New customers:** `first_order_date` within period.
- **Returning customers:** `first_order_date` before period AND `last_order_date` within period.

### Client fix

When RPC returns KPIs but omits customer fields, `fetchCustomerMetricsForStatistics()` queries `customers` with the same date logic instead of phone-heuristic fallback.

Phone-based fallback in `calculateStatistics` remains only when KPIs are entirely absent (legacy offline path).

---

## 6. Caching strategy

| Cache key | TTL (fresh / stale) | When |
|-----------|---------------------|------|
| `stats:{ownerId}:{range}` | 90s / 45s | RPC KPIs available |
| `stats:{ownerId}:{range}` | 30s / 15s | Client fallback mode |
| `dashboard:batch:{ownerId}` | 90s / 45s | Dashboard batch RPC |
| Storefront catalog | 120s / 60s | Public product lists |

**Invalidation triggers:** order create/update/status change, refund flows (`flushOrderCache`), manual statistics refresh (`skipCache: true`).

---

## 7. Remaining recommendations (P2)

1. **Dashboard batch RPC** — `get_dashboard_statistics_batch` still invokes `get_store_statistics` six times internally; consider one SQL function returning all periods in a single scan.
2. **Lazy statistics tabs** — Statistics page loads chart + breakdown data upfront; defer tab-specific fetches until selected.
3. **Refund rollup trigger** — v30 covers amount edits; verify refund status transitions also adjust rollups if partial refunds are stored only in `payment_status` without amount change.

---

## 8. Verification

```bash
npm test
npm run db:deploy   # applies v30
```

**Tests added:** `src/utils/analyticsMetrics.test.ts`, refunded-order case in `statisticsCalculator.test.ts`.
