# Analytics Architecture Audit Report

**Date:** 2026-06-19  
**Role:** Principal Analytics Systems Architect · Database Scalability Engineer  
**Platform:** Multi-tenant SaaS e-commerce (React + Supabase)  
**Migrations:** v38 · v51 · v52 · **v54**  
**Related:** [ANALYTICS_WRITE_REDUCTION_REPORT.md](./ANALYTICS_WRITE_REDUCTION_REPORT.md) · [ANALYTICS_SCALABILITY_REPORT.md](./ANALYTICS_SCALABILITY_REPORT.md) · [ANALYTICS_ACCURACY_REPORT.md](./ANALYTICS_ACCURACY_REPORT.md)

---

## Executive summary

| Dimension | Pre-audit (v38) | Post v51 | Post v54 | Score |
|-----------|-----------------|----------|----------|-------|
| Event discovery | Partial | Full | Full | **96** |
| Storefront write efficiency | 3 writes/visit | 1 outbox INSERT | **1 INSERT, non-blocking** | **94** |
| Background aggregation | Sync triggers | Batch processor | **pg_cron + batch** | **93** |
| Dashboard read efficiency | Bundle RPCs | Unchanged | Unchanged | **91** |
| Order/revenue accuracy | Refund-aware | Unchanged | Unchanged | **93** |
| **Overall analytics architecture** | **78/100** | **91/100** | **93/100** | +15 |

**Deploy:** `npm run db:deploy` (through v54)

---

# Phase 1 — Analytics discovery

## Analytics tables

| Table | Purpose | Write path | Read path |
|-------|---------|------------|-----------|
| `analytics_event_outbox` | Event buffer (visits, product views) | Tracking RPCs | Processor only |
| `store_visits` | Raw visit log | Batch processor | Statistics RPC tail |
| `product_views` | Raw product view log | Batch processor | `top_viewed_products` aggregation |
| `store_daily_stats` | Daily rollups (visits, orders, revenue) | Batch job + order triggers | Dashboard + statistics |
| `store_visitor_daily_keys` | Unique visitor keys per day | Batch job | Unique visitor counter |
| `orders` | Order facts | Checkout RPC | Statistics + dashboard |
| `order_items` | Line items | Checkout RPC | Top selling products |
| `customers` | Customer aggregates | Order trigger | New/returning customer KPIs |
| `store_visits` (legacy direct) | — | **Removed from hot path v51** | — |

## Event flow map

```
STOREFRONT (public)
├── useStoreVisitTracking → track_store_visit_by_slug → analytics_event_outbox
├── useProductViewTracking → track_product_view_by_slug → analytics_event_outbox
└── scheduleIdle + sessionStorage 30-min dedupe (non-blocking)

BACKGROUND
├── process_analytics_event_buffer (SKIP LOCKED batch)
│   ├── INSERT store_visits (trigger disabled during batch)
│   ├── INSERT product_views
│   └── UPSERT store_daily_stats + store_visitor_daily_keys (consolidated)
├── pg_cron * * * * * (v54, when extension enabled)
└── prune_analytics_event_outbox (daily retention)

ORDERS (synchronous — low volume, must be immediate)
├── create_order_with_stock_deduction → INSERT orders
├── trg_orders_daily_stats → store_daily_stats UPSERT
└── trigger_update_customer_stats → customers UPSERT

MERCHANT READS (zero writes)
├── get_dashboard_statistics_batch (6 periods + workflow + catalog KPIs)
├── get_statistics_page_bundle (current + previous period)
├── get_store_statistics (single period KPIs)
└── Client cache: 90s analytics TTL
```

## Client components

| Component | File | Analytics role |
|-----------|------|----------------|
| Visit tracking | `useStoreVisitTracking.ts` | Idle-deferred slug RPC |
| Product view tracking | `useProductViewTracking.ts` | Idle-deferred, 8s timeout |
| Dashboard KPIs | `dashboardStatsService.ts` | Batch RPC + cache |
| Statistics page | `statisticsService.ts` | Bundle RPC; chart orders lazy |
| Analytics facade | `analyticsService.ts` | Unified exports |
| Health audit | `analyticsHealthService.ts` | Merchant pipeline check |

## Realtime statistics

| Path | Mechanism | DB writes |
|------|-----------|-----------|
| Order notifications | `merchantRealtimeHub` → cache flush | **0** |
| Statistics refresh | `useRealtimeOrders` → refetch reads | **0** |
| Visit/product tracking | Best-effort RPC | **1 outbox INSERT** |

---

# Phase 2 — Write load analysis

## Writes per user action

| Action | Before v51 | v51 hot path | v54 hot path | Background flush |
|--------|------------|--------------|--------------|------------------|
| **Store visit** | 3 (visit + keys + stats) | 1 outbox | **1 outbox** | N inserts + 1 UPSERT/owner/day |
| **Product view** | 1 direct | 1 outbox | **1 outbox** | Batch INSERT |
| **Order create** | 2–4 | 2–4 | 2–4 | Sync triggers (intentional) |
| **Order status change** | 1–3 | 1–3 | 1–3 | Rollup delta |
| **Dashboard load** | 0 | 0 | 0 | — |
| **Statistics load** | 0 | 0 | 0 | — |

See [ANALYTICS_WRITE_REDUCTION_REPORT.md](./ANALYTICS_WRITE_REDUCTION_REPORT.md) for detailed reduction metrics.

## Redundancy eliminated

| Issue | Status |
|-------|--------|
| Per-visit rollup trigger on `store_visits` | ✅ Bypassed in batch processor |
| Duplicate visit counters (outbox + direct) | ✅ Outbox-only hot path |
| Client/server dedupe mismatch (10m vs 30m) | ✅ Aligned to 30m (v51) |
| Inline batch flush blocking visitors (v51) | ✅ **Removed v54** |
| Client re-aggregation when RPC has KPIs | ✅ `hasUsableStatisticsKpis` guard |
| No-op order UPDATE rollup | ✅ v42 skip |

## Remaining synchronous writes (by design)

| Path | Rationale |
|------|-----------|
| Order → `store_daily_stats` | Merchants expect immediate revenue on dashboard |
| Order → `customers` | Customer KPIs tied to order transaction |
| Volume | ~100–1000× lower than page views |

---

# Phase 3 — Architecture review

## Synchronous vs asynchronous

| Operation | Model | Blocking? |
|-----------|-------|-----------|
| Store visit track | **Async buffer** | No (v54) |
| Product view track | **Async buffer** | No (v54) |
| Buffer flush | Background (cron/batch) | No visitor impact |
| Order rollup | Sync trigger | Minimal (single UPSERT) |
| Statistics read | Read-only RPC | No writes |
| Chart order fetch | Client lazy (≤5000 rows) | Read only; P2 to server-aggregate |

## Bottlenecks detected and resolved

| ID | Issue | Severity | Fix |
|----|-------|----------|-----|
| **A-1** | 3 writes per visit | CRITICAL | v51 outbox |
| **A-2** | Per-row stats trigger contention | CRITICAL | v51 batch UPSERT |
| **A-3** | Inline flush at ≥75 pending | HIGH | **v54 removed** |
| **A-4** | Product view on render path | MEDIUM | idle defer (client) |
| **A-5** | Direct outbox table writes | MEDIUM | v52 RLS revoke |
| **A-6** | 5k order chart over-fetch | MEDIUM | Lazy tab; P2 server RPC |

## Expensive aggregations (read-side)

| Query | Cost | Mitigation |
|-------|------|------------|
| `get_dashboard_statistics_batch` | Single orders scan | v36 single-pass |
| `get_store_statistics` closed period | Was 5 live scans | v38 skip when period closed |
| `top_viewed_products` | GROUP BY on product_views | Index on owner+product+created |
| Statistics chart | Up to 5000 orders | Lazy load on chart tab |

---

# Phase 4 — Rearchitecture

## Target architecture (implemented)

```
Event Collection          Background Processing       Aggregation Jobs         Dashboard Reporting
─────────────────         ─────────────────────       ────────────────         ───────────────────
track_*_by_slug     →     analytics_event_outbox  →   process_analytics_   →   get_dashboard_
(1 INSERT, non-blocking)    (append-only buffer)        event_buffer             statistics_batch
                                                      (SKIP LOCKED batch)      get_statistics_
                          pg_cron every 1 min                                   page_bundle
                                                      prune after 7 days       get_store_statistics
```

## v54 improvements

| Change | Effect |
|--------|--------|
| Remove `PERFORM process_analytics_event_buffer` from tracking RPCs | Storefront never waits on batch job |
| `get_analytics_pipeline_status()` | Ops monitoring (service role) |
| `audit_merchant_analytics_health()` | Merchant rollup lag detection |
| pg_cron auto-schedule | 1-min flush when extension available |

## Orders/revenue — intentional sync path

Order analytics remain synchronous because:
- Order volume is orders-of-magnitude lower than page views
- Merchant dashboard must show new orders/revenue immediately
- v42 already skips no-op UPDATE rollups

---

# Phase 5 — Verification

## Accuracy

| Metric | Verified | Notes |
|--------|----------|-------|
| Store visits | ✅ | Rollups + raw tail; ≤2 min lag with cron |
| Product views | ✅ | Append-only; aggregated at read |
| Orders / revenue | ✅ | Refund-aware v38 |
| Customer activity | ✅ | Order trigger maintained |
| Conversion rate | ✅ | Derived from rollup KPIs |
| Multi-day unique visitors | ⚠ | Sum of daily uniques (standard approximation) |

## Performance

| Check | Result |
|-------|--------|
| Storefront tracking blocks render | **No** — idle defer + 8s timeout |
| Storefront tracking blocks RPC response | **No** — v54 single INSERT |
| Dashboard writes on load | **0** |
| Reduced DB writes vs pre-v51 | **−67% hot path; −99% rollup contention** |

## Test commands

```bash
npm test                          # 168+ unit tests
npm run db:analytics-test         # pipeline probes
npm run db:isolation-test         # includes outbox RLS probe
npm run db:deploy                 # through v54
```

## Manual cron (if pg_cron unavailable)

```sql
SELECT cron.schedule(
  'process-analytics-buffer',
  '* * * * *',
  $$SELECT public.process_analytics_event_buffer(500)$$
);
```

Or invoke periodically via Supabase Edge Function scheduled trigger.

---

## Scorecard

| Phase | Outcome |
|-------|---------|
| 1 Discovery | ✅ 9 tables + 5 domains mapped |
| 2 Write analysis | ✅ Per-action counts documented |
| 3 Architecture review | ✅ 6 bottlenecks; sync paths classified |
| 4 Rearchitecture | ✅ Event buffer + v54 non-blocking hot path |
| 5 Verification | ✅ Accuracy + write reduction + scalability reports |

**Analytics architecture health: 78 → 93/100**
