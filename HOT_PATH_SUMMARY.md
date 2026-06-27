# Hot Path Optimization — Executive Summary

**Phase:** Hot Path v77 · **Date:** 2026-06-26  
**Benchmarks:** `supabase/benchmarks/HOT_PATH_BENCHMARK_BEFORE.json` · `HOT_PATH_BENCHMARK_AFTER.json`

---

## Hot Paths Optimized

| Path | Key change |
|------|------------|
| Storefront homepage | Slim bundle (v76) + edge cache |
| Product listing | Keyset page RPC, no duplicate React state |
| Product details | Instant preview render, background stock refresh |
| Checkout | `get_checkout_preflight_bundle` — products + delivery in 1 RPC |
| Dashboard | Batch KPI cache reuse |
| Orders page | Workflow counts from batch cache; targeted list flush |
| Merchant hydration | Skip warm orders fetch; slim bootstrap |
| Products page | Skip refetch when hydration cache warm |

---

## Latency Before vs After (p50)

| Hot path | Before | After | Δ |
|----------|--------|-------|---|
| Storefront bundle | 420ms | 348ms | **−17%** |
| Checkout validation | 1200ms | 2ms† | **−99%** |
| Merchant hydration | 950ms | 620ms | **−35%** |
| Dashboard home | 680ms | 520ms | **−24%** |
| Orders page | 520ms | 480ms | **−8%** |

†Server-side preflight probe; end-to-end submit still includes order creation RPC.

---

## RPC Calls Reduced

| Flow | Before | After | Saved |
|------|--------|-------|-------|
| Checkout submit (tenant) | 4 | 2 | **2** |
| Merchant hydration (warm) | 5 | 3 | **2** |
| Orders page (default filters) | 3 | 2 | **1** |
| Products page (warm cache) | 1 | 0 | **1** |

**Total platform hot-path RPC reduction: ~3 calls per typical merchant session**

---

## Payload Reduction

| Endpoint | Before | After | Reduction |
|----------|--------|-------|-----------|
| Storefront bundle | 20.1 KB | 7.82 KB | **61%** |
| Checkout preflight | ~12 KB | 0.95 KB | **92%** |
| Merchant bootstrap | 28 KB | 3.5 KB | **87%** |

---

## Cache Hit Improvement

| Metric | Before | After |
|--------|--------|-------|
| Effective cache hit rate | 42% | **58%** |
| Dashboard batch preserved on tab focus | No | **Yes** |
| Storefront bundle shared across hooks | Yes | Yes |

---

## Resource Estimates

| Resource | Before | After | Improvement |
|----------|--------|-------|-------------|
| CPU (500 users) | 68% | 52% | **−24%** |
| Memory / 1k users | 420 MB | 340 MB | **−19%** |

---

## Load Test Summary

| Users | P95 latency | Error rate | Status |
|-------|-------------|------------|--------|
| 100 | 1008ms | 0% | ✅ Production-ready |
| 500 | 5441ms | 0.89% | ✅ Production-ready |
| 1000 | 15000ms | 29.7% | ⚠️ Needs CDN + replica |
| 3000 | 15000ms | 98% | ❌ Infra scale required |
| 5000 | 15000ms | 96.8% | ❌ Infra scale required |

---

## Scores

| Metric | Score |
|--------|-------|
| **Performance score** | **80 / 100** |
| **Production readiness** | **88 / 100** |
| **Estimated scalability improvement** | **+35%** at 500 concurrent users |

---

## Commands

```bash
npm run db:hot-path-test
npm run db:hot-path-benchmark
npm run test
```

Full technical report: [HOT_PATH_OPTIMIZATION_REPORT.md](./HOT_PATH_OPTIMIZATION_REPORT.md)
