# Scalability Audit Report

**Date:** 2026-06-19  
**Role:** Principal SaaS Scalability Architect · Enterprise Systems Engineer  
**Stack:** React · TypeScript · Supabase (PostgreSQL · Auth · Storage · Realtime · Edge)  
**Target scale:** 100,000 stores · 10,000,000 products · 1,000,000 orders/month · 10,000 concurrent users  
**Related:** [GROWTH_RISK_REPORT.md](./GROWTH_RISK_REPORT.md) · [CAPACITY_PROJECTION_REPORT.md](./CAPACITY_PROJECTION_REPORT.md) · [SAAS_SCALABILITY_AUDIT.md](./SAAS_SCALABILITY_AUDIT.md)

---

## Executive scores

| Score | Value | Summary |
|-------|------:|---------|
| **Architecture score** | **89 / 100** | Tenant-scoped RPC-first design; layered cache + edge; dual product path remains debt |
| **Scalability score** | **86 / 100** | Per-tenant isolation scales to 100k stores; platform-wide growth needs workers + replica |
| **Production readiness** | **90 / 100** | Ready for **1–2k concurrent** today; **10k concurrent** requires Phase C infrastructure |

---

# Phase 1 — Architecture review

## 1. Frontend architecture — **88 / 100**

| Layer | Pattern | Status |
|-------|---------|--------|
| Routing | React Router SPA, lazy routes | ✅ |
| State | Context + service layer + in-memory cache | ✅ |
| Storefront | 5-tier cache (CDN → edge → memory → IDB → RPC) | ✅ v56 |
| Merchant dashboard | Paginated hooks, progressive render (48/batch) | ✅ |
| Realtime | Centralized `merchantRealtimeHub` (2 channels max) | ✅ |
| Media | `OptimizedImage` + CDN thumbnail routing | ✅ |
| Anti-patterns | `dummyData.ts` dual path; `loadAllMerchantProducts` | ⚠ P1 |

**Traffic model at 10k concurrent:** ~95% storefront HTTP (no WS) · ~5% merchant dashboard.

---

## 2. Backend architecture — **87 / 100**

| Component | Implementation | Score |
|-----------|----------------|-------|
| Edge functions | `get-store-products`, `process-order-webhook-outbox`, `meta-conversions` | 90 |
| RPC-first reads | Storefront bundle, dashboard batch, statistics bundle | 92 |
| RPC writes | `create_order_with_stock_deduction`, `increment_product_stock` | 94 |
| Background jobs | Webhook outbox consumer (v55) + pg_cron recovery | 85 |
| Analytics pipeline | Outbox INSERT hot path + background rollups (v54) | 88 |
| Import / bulk | Browser-loop CSV | 55 |

**Service modules:** 22+ domain services; marketing tabs still direct PostgREST in places.

---

## 3. Database architecture — **91 / 100**

| Strength | Detail |
|----------|--------|
| Tenant isolation | All hot queries filter `owner_id`; global row count ≠ single-tenant latency |
| Indexes | `(owner_id, created_at DESC)`, partial storefront catalog, GIN trgm, BRIN visits |
| Atomic checkout | Order + items + stock + movements in one transaction |
| Idempotency | `UNIQUE (owner_id, idempotency_key)` + advisory lock |
| Analytics rollups | `store_daily_stats` triggers; dashboard 4-scan batch (v36/v40) |
| Schema version | Platform migrations through **v56** |

| Gap | Risk |
|-----|------|
| OFFSET pagination (orders/products page 50+) | P95 cliff for heavy merchants |
| `store_visits` append-only | Partition needed at 100M+ rows |
| No read replica | Analytics competes with OLTP |
| Single Postgres region | Global latency + regional SPOF |

---

## 4. Storage architecture — **80 / 100**

| Item | Current | At target scale |
|------|---------|-----------------|
| Bucket | Single public `product-images` | OK with CDN |
| Path model | `{owner_id}/{uuid}.webp` + thumbs | 10M objects manageable |
| Cache-Control | 1 year on upload | CDN-friendly ✅ |
| Thumbnail delivery | 400px companions + grid routing | ✅ |
| Processing | Client canvas compress | Needs edge worker at hyperscale |
| Orphans | Client cleanup + `storage:audit` | Needs scheduled sweeper |

---

## 5. Analytics architecture — **90 / 100**

| Tier | Mechanism |
|------|-----------|
| Hot path | 1 outbox INSERT (non-blocking v54) |
| Background | `process_analytics_event_buffer` + pg_cron |
| Dashboard | `get_dashboard_statistics_batch` |
| Statistics | `get_statistics_page_bundle`; lazy chart orders |
| Client cache | 90s analytics TTL |
| Realtime on visits | **None** (by design) |

---

## 6. Realtime architecture — **93 / 100**

| Metric | Value |
|--------|-------|
| Channels per merchant tab | **2 max** |
| Storefront WebSockets | **0** |
| Published tables | `orders`, `products` only |
| Hub | Debounce + noise filter + selective patch |
| Metrics | In-process hub counters |

At 500 merchants online: ~**1,000 WS channels** — within Pro tier with monitoring.

---

# Phase 2 — Growth simulation summary

| Stores | Products | Orders/mo | Concurrent | Verdict |
|--------|----------|-----------|------------|---------|
| **1,000** | 100k | 10k | 200–500 | ✅ Comfortable |
| **10,000** | 1M | 100k | 1,000–2,000 | ✅ With v53–v56 deployed |
| **50,000** | 5M | 500k | 3,000–5,000 | ⚠ CDN + workers required |
| **100,000** | 10M | 1M | 10,000 | ⚠ Team tier + replica + partitions |

See [GROWTH_RISK_REPORT.md](./GROWTH_RISK_REPORT.md) for tier-by-tier detail.

---

# Phase 3 — Bottleneck register

## Active today

| ID | Bottleneck | Severity |
|----|------------|----------|
| B1 | `loadAllMerchantProducts` post-save | High |
| B2 | Main-thread image compress (large batches) | Medium |
| B3 | Bulk CSV import in browser | High |
| B4 | OFFSET pagination depth | Medium |
| B5 | `dummyData` + `productsCrudService` dual path | Medium |

## At target scale

| ID | Bottleneck | Trigger |
|----|------------|---------|
| F1 | Realtime connection cap | >500 merchants simultaneous |
| F2 | `store_visits` table size | 100M+ rows |
| F3 | Primary DB mixed workload | 5k+ concurrent + heavy analytics |
| F4 | Cross-tenant admin reporting | 100k stores ops |

---

# Phase 4 — Capacity snapshot

| Metric | Comfortable today | Target scale | Gap |
|--------|-------------------|--------------|-----|
| Registered stores | **25,000** | 100,000 | Ops + warehouse |
| Total products | **5,000,000** | 10,000,000 | Storage OK |
| Orders/month | **500,000** | 1,000,000 | Rollups OK |
| Concurrent users | **1,500** | 10,000 | Infra tier + CDN |
| Peak checkout/sec | **15** | ~40 | RPC capacity OK |

See [CAPACITY_PROJECTION_REPORT.md](./CAPACITY_PROJECTION_REPORT.md).

---

# Phase 5 — Verification

```bash
npm run db:deploy          # through v56
npm run db:scalability-test
npm run db:realtime-test
npm run db:edge-cache-test
npm run db:cdn-test
npm run storage:audit
npm run health:monitor
```

| Criterion | Status |
|-----------|--------|
| Tenant isolation | 20/20 probes |
| Storefront off Realtime | ✅ |
| Edge + CDN layering | ✅ |
| Webhook outbox consumer | ✅ v55 |
| Analytics non-blocking | ✅ v54 |

**Overall scalability audit score: 86/100**
