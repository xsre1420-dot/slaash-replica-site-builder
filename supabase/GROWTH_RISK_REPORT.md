# Growth Risk Report

**Date:** 2026-06-19  
**Role:** Principal SaaS Scalability Architect  
**Target:** 100,000 stores · 10M products · 1M orders/month · 10k concurrent  
**Related:** [SCALABILITY_AUDIT_REPORT.md](./SCALABILITY_AUDIT_REPORT.md) · [CAPACITY_PROJECTION_REPORT.md](./CAPACITY_PROJECTION_REPORT.md)

---

## Risk score: **84 / 100** (residual risk after mitigations)

---

# Tier 1 — 1,000 stores

**Profile:** ~800 storefront · ~40 merchants online · ~100k products · ~10k orders/month · 200–500 concurrent

| Domain | Risk | Level | Mitigation |
|--------|------|-------|------------|
| Database | Per-tenant queries fast | **Low** | Owner indexes ✅ |
| Realtime | ~80 WS channels | **Low** | Hub consolidation ✅ |
| Storage | <500k objects | **Low** | WebP + thumbs ✅ |
| Analytics | Visit volume modest | **Low** | Outbox + rollups ✅ |
| Checkout | <1 order/sec peak | **Low** | Atomic RPC ✅ |

**Breaking point:** None at this tier.  
**Confidence:** **Very high**  
**Required infra:** Supabase Pro, `db:deploy` v56

---

# Tier 2 — 10,000 stores

**Profile:** ~4,750 storefront · ~250 merchants · ~1M products · ~100k orders/month · 1,000–2,000 concurrent

| Domain | Risk | Level | Mitigation |
|--------|------|-------|------------|
| Database | Long-tail store count | **Low** | Slug-scoped queries |
| Realtime | ~500 WS channels | **Medium** | Monitor 80% cap |
| Storefront | Origin RPC storm on viral store | **Medium** | Edge cache v56 ✅ |
| Media egress | Grid full-size images | **Low** | CDN thumbs ✅ |
| Webhooks | Outbox backlog | **Low** | v55 consumer ✅ |
| Merchant UX | 500+ SKU save reload | **Medium** | P1: remove full catalog reload |
| Bulk import | CSV >50 rows | **High** | P1: `import_jobs` queue |

**Breaking point:** Viral storefront without edge CDN fronting.  
**Confidence:** **High** (with v53–v56 deployed)  
**New requirements:** Edge function deployed; CDN optional but recommended

---

# Tier 3 — 50,000 stores

**Profile:** ~23k storefront · ~1,250 merchants · ~5M products · ~500k orders/month · 3,000–5,000 concurrent

| Domain | Risk | Level | Mitigation |
|--------|------|-------|------------|
| Database CPU | Mixed OLTP + analytics | **High** | Read replica (P2) |
| `store_visits` | 20–50M rows | **High** | Monthly partition (P2) |
| Realtime | ~1,250 WS — plan limit | **High** | Enterprise tier or push alt |
| Storage objects | 5M+ images | **Medium** | CDN + orphan sweeper |
| OFFSET pagination | Heavy merchant lists | **Medium** | Keyset pagination (P1) |
| Cross-tenant admin | Platform health scans | **Medium** | Materialized views |
| Image upload | Client-only processing | **Medium** | Edge worker (P3) |

**Breaking point:** Realtime merchant cap OR primary DB CPU >85% sustained.  
**Confidence:** **Medium-high**  
**Gate G2:** CDN hit >60%; outbox pending <50; keyset shipped

---

# Tier 4 — 100,000 stores

**Profile:** ~9,500 storefront · ~500 merchants · **10M products** · **1M orders/month** · **10,000 concurrent**

| Domain | Risk | Level | Impact |
|--------|------|-------|--------|
| **Realtime WS cap** | **Critical** | ~1,000 channels at plan limit | Merchant live updates degrade |
| **Primary DB** | **High** | Single region OLTP | Checkout latency spikes |
| **`store_visits`** | **High** | 100M+ rows without partition | Write amplification |
| **Storage egress** | **Medium** | 10M images × traffic | Cost + latency |
| **Platform admin** | **Medium** | Cross-tenant aggregates | OLTP scan risk |
| **Import queue** | **High** | No fair scheduling | Tenant starvation |
| **Multi-region** | **Medium** | Single Postgres region | Global P95 latency |

**Breaking points (ordered):**

1. **Supabase Realtime connection limit** (~500–2,000 depending on plan)  
2. **Primary Postgres CPU** under mixed analytics + checkout  
3. **`store_visits` write rate** without partitioning  
4. **Heavy merchant OFFSET** pagination (page 50+)

**Confidence:** **Medium** — achievable with roadmap H2–H3  
**Gate G3:** Read replica live; Realtime <80% cap; visit partition active

---

# Tenant scaling risks

| Risk | Likelihood | Impact | Priority |
|------|------------|--------|----------|
| One viral store overwhelms shared edge | Medium | Medium | CDN + rate limits ✅ |
| Merchant with 10k+ products + OFFSET | Low | High for tenant | Keyset P1 |
| Cross-tenant data leak | Low | Critical | Isolation probes ✅ |
| Migration deploy drift | Medium | High perf regression | CI gate P0 |
| Webhook delivery failure | Low (post-v55) | Medium | Monitor outbox lag |
| Storage orphan accumulation | Medium | Cost | Scheduled sweeper P2 |

---

# Single points of failure

| SPOF | Mitigation status |
|------|-------------------|
| Single Postgres primary | PITR + failover partial; replica P2 |
| Supabase Realtime | Hub reconnect; polling fallback |
| Client in-memory cache | Edge + CDN layers ✅ |
| SPA-only image processing | Edge worker P3 |
| No platform warehouse | Admin MV P3 |

---

# Risk heat map

```
Impact ▲
  Critical │                    ● Realtime cap @ 10k
  High     │     ● Visit partition    ● DB CPU mixed load
  Medium   │ ● Bulk import  ● OFFSET depth  ● Admin cross-tenant
  Low      │ ● Orphan storage
           └──────────────────────────────────────────► Likelihood
                Low        Medium        High
```

---

# Recommended risk reduction timeline

| Horizon | Timeline | Risk reduction |
|---------|----------|----------------|
| **H1** | 0–6 weeks | Deploy v53–v56; remove catalog reload; monitor Realtime |
| **H2** | 2–4 months | Keyset pagination; import jobs; CDN fronting |
| **H3** | 4–9 months | Read replica; visit partitions; image worker |
| **H4** | 9–18 months | Multi-region; event warehouse; fair queue |

**Growth risk score: 84/100** (lower residual risk = better; 84 reflects manageable risk at target with roadmap execution)
