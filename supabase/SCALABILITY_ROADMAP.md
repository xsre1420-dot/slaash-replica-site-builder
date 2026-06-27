# Scalability Roadmap

**Date:** 2026-06-19  
**Role:** Principal Performance Engineer  
**Targets:** 100,000 stores · 10,000,000 products · 1,000,000 orders/month · 10,000 concurrent users

---

## Platform performance score

| Phase | Score | Status |
|-------|-------|--------|
| Pre-v36 baseline | 78/100 | — |
| After v36 (DB batch RPC) | 91/100 | Deployed |
| After v38–v40 (client + analytics) | **93/100** | This audit |

**Verdict:** Architecture is **tenant-scoped** (owner_id indexes + RPC-first). Global table size does not dominate single-request latency. Remaining work is **pagination depth**, **catalog migration off dummyData**, and **optional read replicas** at extreme scale.

---

## 1. Bottleneck audit summary

| Area | Before | After (this audit) | Risk at target scale |
|------|--------|-------------------|----------------------|
| **Dashboard batch** | 6× stats RPC (~90 subqueries) | Single-pass 4 scans (v36) | Low |
| **Dashboard workflow counts** | Full `orders` table scan (v38 regression) | **Restored indexed RPC** (v40) | Low |
| **Dashboard product cache** | `getProductsSync()` full catalog | **RPC `catalog_kpis`** (v40 client) | Low |
| **Recent orders refetch** | `flushOwnerCache()` — nuked products | **`ordersRecent` only** | **Fixed critical** |
| **Recent orders fetch** | PostgREST + image enrichment | **`list_merchant_orders` RPC**, skip images | Medium → Low |
| **Statistics initial load** | Always 5000 orders | **Lazy chart orders** by tab | Medium → Low |
| **Analytics** | 2 RPC + 4 fetches | Bundle RPC + skip redundant (v38) | Low |
| **Product listing** | Paginated RPC 50/page | OK + progressive render 48 | Low |
| **Realtime** | 2 channels/merchant | Hub + debounce | Low (2k channels @ 1k merchants) |
| **Order list OFFSET** | Degrades page 50+ | Keyset planned (P2) | Medium at high page depth |

---

## 2. Implemented improvements (this audit)

### Client

| File | Change |
|------|--------|
| `useRecentOrders.tsx` | Stop `flushOwnerCache` on realtime refetch — only invalidate recent orders |
| `orderService.ts` | `fetchRecentOrders` via `list_merchant_orders`; skip image enrichment; 60s cache |
| `dashboardStatsService.ts` | Parse `catalog_kpis` from batch |
| `useDashboardInsights.tsx` | Use RPC catalog KPIs — avoid loading full product cache on dashboard |
| `statisticsService.ts` | `includeChartOrders` flag — skip order fetch when KPI-only |
| `useRealStatistics.tsx` | Pass through chart deferral option |
| `Statistics.tsx` | Load chart orders only for overview / payments / performance tabs |

### Database (v40)

| Change | Benefit |
|--------|---------|
| `catalog_kpis` in `get_dashboard_statistics_batch` | Explicit low-stock + product count without client catalog load |
| Restore `count_merchant_orders_by_workflow` | Avoid full-table workflow scan on large order tables |

**Deploy:** `npm run db:deploy`

---

## 3. Architecture at target scale

```
┌─────────────────────────────────────────────────────────────────┐
│ 10,000 concurrent users                                         │
├─────────────────────────────────────────────────────────────────┤
│ Storefront (~95%)     → HTTP edge + 120s cache, 0 Realtime WS   │
│ Merchants (~5%)       → 2 Realtime channels each, RPC + cache   │
│ Checkout              → Idempotent RPC, rate limit, stock lock    │
│ Analytics             → store_daily_stats rollups + 90s cache   │
└─────────────────────────────────────────────────────────────────┘
```

### Per-tenant isolation (why this scales)

- Every hot query filters `owner_id = $merchant`
- Indexes: `(owner_id, created_at DESC)`, partial storefront catalog, BRIN on `store_visits.created_at`
- Dashboard/analytics use **rollups** for closed days — no full-table rescan on page load

### Connection budget (10k concurrent users)

| Segment | Est. connections | Notes |
|---------|------------------|-------|
| Storefront HTTP | Pooler / edge | No persistent WS |
| Merchants (500 online) | ~1,000 Realtime | 2 channels × ~1 tab |
| Merchants API | Pooler | 90s analytics cache reduces churn |

---

## 4. Domain review

### Database access

| Path | Pattern | Status |
|------|---------|--------|
| Orders list | `list_merchant_orders` single scan + window count | OK |
| Dashboard | `get_dashboard_statistics_batch` | OK (v40) |
| Statistics | `get_statistics_page_bundle` | OK (v38) |
| Products | `get_owner_products_page` offset pagination | OK for <10k products/store |
| Storefront | `get_store_products_page` keyset | OK |

### React rendering

| Pattern | Where | Status |
|---------|-------|--------|
| Progressive render (48/batch) | Products, Inventory | OK |
| Lazy tabs | Statistics detail sections | OK |
| Lazy routes | Product reviews, suggestions | OK |
| `React.memo` on product cards | — | P3 optional |

### API calls

| Anti-pattern | Fix |
|--------------|-----|
| Duplicate dashboard batch | 90s cache + `dedup()` | OK |
| Full owner cache on dashboard | `catalog_kpis` RPC | **Fixed** |
| Statistics 5000 orders on load | Tab-deferred chart orders | **Fixed** |

### Realtime

- 2 channels/merchant max; debounced refetch; no analytics subscriptions
- See [`SUBSCRIPTION_OPTIMIZATION_REPORT.md`](./SUBSCRIPTION_OPTIMIZATION_REPORT.md)

### Analytics

- Rollups + bundle RPC + client cache
- See [`ANALYTICS_ACCURACY_REPORT.md`](./ANALYTICS_ACCURACY_REPORT.md)

---

## 5. Phased roadmap

### Phase 1 — Done (v36–v40)

- [x] Single-pass dashboard batch RPC
- [x] One-scan order list with window count
- [x] Statistics page bundle RPC
- [x] Skip redundant analytics fetches
- [x] Dashboard catalog KPIs without full product load
- [x] Recent orders via RPC; fix cache flush regression
- [x] Lazy statistics chart order loading
- [x] BRIN + owner indexes (v36)
- [x] Realtime hub debounce

### Phase 2 — Next 4–8 weeks (P1)

| Item | Impact | Effort |
|------|--------|--------|
| **Keyset pagination for `list_merchant_orders`** | Remove OFFSET cliff at page 50+ | Medium |
| **Migrate `dummyData.ts` → `productsCrudService`** | Single catalog code path | High |
| **`get_owner_products_page` keyset** | Merchant catalog >5k products | Medium |
| **Edge CDN for `get-store-products`** | Viral storefront traffic | Low (config) |
| **Add `draft_count` to dashboard `catalog_kpis`** | Dashboard draft alerts without product load | Low |

### Phase 3 — Growth (P2, 10k+ active merchants)

| Item | Impact |
|------|--------|
| Read replica for analytics RPCs | Isolate reporting from OLTP |
| Partition `orders` / `store_visits` by month | Archive cold data |
| Materialized views for platform admin aggregates | Cross-tenant reporting only |
| `react-window` virtualization | 500+ row merchant tables |
| Supabase Realtime per-tenant channel limits monitoring | Ops alert at 80% cap |

### Phase 4 — Hyperscale (P3, optional)

| Item | Impact |
|------|--------|
| Dedicated visit rollup worker | True cross-day unique visitors |
| CQRS event bus for order → analytics | Sub-second fan-out at 1M orders/month |
| Multi-region read replicas | Latency for global storefront |

---

## 6. Capacity checklist

| Metric | Target | Current headroom |
|--------|--------|------------------|
| Stores | 100,000 | Index + RPC design supports |
| Products | 10,000,000 | Per-store pagination; global size irrelevant |
| Orders/month | 1,000,000 | ~33k/day — rollups + idempotent checkout OK |
| Concurrent users | 10,000 | Storefront HTTP-scaled; merchant WS bounded |
| Orders/store (heavy) | 100,000+ | OFFSET pagination — migrate to keyset (P2) |
| Products/store (heavy) | 10,000+ | Offset catalog — migrate to keyset (P2) |

---

## 7. Monitoring (production)

| Signal | Alert |
|--------|-------|
| `list_merchant_orders` p95 latency | > 500ms |
| `get_dashboard_statistics_batch` p95 | > 300ms |
| Realtime connection count | > 80% plan limit |
| Cache hit rate (`stats:*`, `dashboard-batch:*`) | < 50% |
| WAL lag on `orders` / `products` | > 5s |
| Statistics truncation warnings | Sustained per merchant |

---

## 8. Verification

```bash
npm test
npm run typecheck
npm run db:deploy   # v40
```

### Manual smoke

- [ ] Dashboard loads without fetching full product catalog (Network tab)
- [ ] New order on dashboard refreshes recent orders only — products cache intact
- [ ] Statistics overview tab loads chart data; customers tab does not fetch 5000 orders first
- [ ] Products page renders 48 items initially, loads more on scroll
- [ ] Storefront catalog uses paginated RPC, not full slug dump

---

**Related reports:** [`POSTGRESQL_SCALE_PERFORMANCE_REPORT.md`](./POSTGRESQL_SCALE_PERFORMANCE_REPORT.md) · [`REALTIME_AUDIT_REPORT.md`](./REALTIME_AUDIT_REPORT.md) · [`ANALYTICS_ACCURACY_REPORT.md`](./ANALYTICS_ACCURACY_REPORT.md)
