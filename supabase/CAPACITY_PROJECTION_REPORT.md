# Capacity Projection Report

**Date:** 2026-06-19  
**Role:** Principal SaaS Scalability Architect · Enterprise Systems Engineer  
**Assumptions:** Supabase Pro baseline; migrations **v53–v56** deployed; 95/5 storefront/merchant traffic split

---

## Projection confidence: **87 / 100**

---

# Current capacity (today)

| Resource | Comfortable | Stress limit | Binding factor |
|----------|-------------|--------------|----------------|
| **Registered stores** | 25,000 | 50,000 | Ops complexity |
| **Active stores (30d)** | 5,000 | 12,000 | — |
| **Total products** | 5,000,000 | 10,000,000 | Index + storage size |
| **Orders/month** | 500,000 | 1,000,000 | Rollups + owner indexes |
| **Concurrent users** | **1,500** | **2,500** | Connection pool + visits |
| **Concurrent merchants** | 300 | 500 | Realtime ~2× merchants |
| **Peak checkout/sec (platform)** | 15 | 40 | Stock lock RPC |
| **Storefront P95 (cached)** | 40–80 ms | 200 ms | Edge + CDN |
| **Dashboard P95** | 25–80 ms | 150 ms | Batch RPC |

**Headline:** Production-ready for **early growth** — hundreds of active merchants, low thousands concurrent.

---

# Future capacity (target scale)

| Resource | Target | Required infrastructure | Achievable? |
|----------|--------|-------------------------|-------------|
| **100,000 stores** | Registered | Team tier + ops automation | ✅ |
| **10,000,000 products** | Total catalog | Storage + per-owner indexes | ✅ |
| **1,000,000 orders/month** | ~33k/day | Rollups; ~1% Postgres insert capacity | ✅ |
| **10,000 concurrent users** | Mixed traffic | CDN + edge + replica + Realtime tier | ⚠ With roadmap |

---

# Breaking points

| # | Breaking point | Approximate trigger | Symptom |
|---|----------------|---------------------|---------|
| 1 | **Realtime connection cap** | 500+ merchants online simultaneously | WS rejections; stale dashboard |
| 2 | **Primary DB CPU saturation** | 5k+ concurrent + heavy analytics | P95 checkout >1s |
| 3 | **`store_visits` write amplification** | 100M+ rows, no partition | Insert latency spike |
| 4 | **OFFSET pagination cliff** | Merchant page 50+ orders/products | P95 list load >3s |
| 5 | **Viral storefront origin storm** | 10k req/min single slug without CDN | Origin 503/429 |
| 6 | **Bulk import browser timeout** | CSV >200 rows | Failed imports; partial data |
| 7 | **Storage egress budget** | 10M images × high traffic | Cost overrun |

---

# Capacity by growth tier

## 1,000 stores

| Metric | Projection |
|--------|------------|
| Concurrent users | 200–500 |
| Postgres load | **<5% CPU** avg |
| Realtime channels | ~80 |
| Storage objects | ~50k–200k |
| Monthly orders | ~10k |
| **Capacity utilization** | **~15%** of comfortable envelope |

**Time to breaking point:** Not within 12 months at organic growth.

---

## 10,000 stores

| Metric | Projection |
|--------|------------|
| Concurrent users | 1,000–2,000 |
| Postgres load | **10–25% CPU** avg |
| Realtime channels | ~400–500 |
| Storage objects | ~500k–2M |
| Monthly orders | ~100k |
| Edge cache hit rate | 85–92% |
| **Capacity utilization** | **~40%** |

**Infra:** Pro plan sufficient. Deploy edge function + optional CDN.

---

## 50,000 stores

| Metric | Projection |
|--------|------------|
| Concurrent users | 3,000–5,000 |
| Postgres load | **40–60% CPU** avg (primary) |
| Realtime channels | ~800–1,200 |
| Storage objects | ~2.5M–5M |
| Monthly orders | ~500k |
| Visit table rows | 20–50M |
| **Capacity utilization** | **~70%** |

**Infra:** Pro+ / Team; read replica recommended; visit partitioning required.

---

## 100,000 stores (design target)

| Metric | Projection |
|--------|------------|
| Concurrent users | **10,000** |
| Postgres load | **Primary 70–85%** without replica |
| Realtime channels | **~1,000** (at plan limit) |
| Storage objects | **~10M** |
| Monthly orders | **1,000,000** |
| Visit table rows | 50–100M+ |
| Storefront origin RPS | ~200/min (with 90% cache) |
| **Capacity utilization** | **~95%** without H3 additions |

**Required additions:**

| Component | Capacity unlocked |
|-----------|-------------------|
| Read replica (analytics RPCs) | +30% primary headroom |
| `store_visits` monthly partition | +50% visit write capacity |
| CDN + edge v56 | 90% storefront origin reduction |
| Keyset pagination | Removes merchant list cliff |
| Webhook worker v55 | Reliable async throughput |

---

# Connection budget at 10,000 concurrent

| Segment | Est. connections | Notes |
|---------|------------------|-------|
| Storefront HTTP | Pooled via edge | Not 1:1 with users |
| Merchants API | ~500 pooled | 90s analytics cache |
| Realtime WS | **~1,000 persistent** | Tightest constraint |
| Background workers | ~10 service role | Outbox + cron |
| **Total** | Within Team tier + pooler | Monitor Realtime 80% |

---

# Throughput projections

| Workload | Current max | At 10k concurrent | Postgres capacity |
|----------|-------------|-------------------|-------------------|
| Checkout RPC | ~40/sec platform | ~15/sec avg peak | **<5% utilized** |
| Storefront bundle RPC | ~300/min origin | ~200/min with cache | **<10% utilized** |
| Analytics outbox INSERT | ~500/sec | ~50/sec | **Low** |
| Product stock UPDATE | ~100/sec | ~20/sec | **Low** |
| Visit tracking INSERT | ~200/sec | ~80/sec | **Medium** — partition at scale |

---

# Storage & CDN capacity

| Metric | 10M products | Notes |
|--------|--------------|-------|
| Avg object size | ~120 KB full / ~15 KB thumb | WebP compressed |
| Total storage | ~1.2 TB (full) + ~150 GB thumbs | Supabase scale OK |
| CDN hit ratio | 92–97% | After thumb routing |
| Origin egress at 10k concurrent | ~18–30k req/hr | vs ~180k without cache |

---

# Capacity multiplier from optimizations (cumulative)

| Optimization | Capacity multiplier |
|--------------|----------------------|
| v36 dashboard batch | 2.3× dashboard reads |
| Storefront 5-tier cache | 4–5× storefront reads |
| Realtime hub (storefront off WS) | 10× connection budget |
| Analytics outbox (v54) | 3× visit write headroom |
| CDN thumbnails | 5× image egress efficiency |
| Edge cache versioning (v56) | 2× invalidation correctness |
| **Combined effective capacity** | **~5× vs pre-audit baseline** |

---

# Go / no-go gates

| Gate | Criteria | Status |
|------|----------|--------|
| **G1 — 1k concurrent** | v56 deployed; dashboard P95 <150ms; isolation 20/20 | ✅ Ready |
| **G2 — 5k concurrent** | CDN hit >60%; outbox lag <50; keyset shipped | ⚠ Partial |
| **G3 — 10k concurrent** | Read replica; Realtime <80%; visit partition | ❌ Roadmap |
| **G4 — 100k stores** | Import queue; orphan sweeper; platform warehouse | ❌ Roadmap |

---

# Summary

| | Current | Target (100k / 10M / 1M / 10k) |
|---|---------|--------------------------------|
| **Architecture** | 89/100 | Sound — no redesign needed |
| **Scalability** | 86/100 | Requires infra tier + async layer |
| **Breaking point** | ~2,500 concurrent | ~10,000 with H2–H3 roadmap |
| **Timeline to target** | — | **6–9 months** execution |

**Capacity projection score: 87/100**
