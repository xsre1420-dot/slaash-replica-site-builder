# Expected Capacity Increase — Storefront Payload Optimization

**Date:** 2026-06-19  
**Change:** Migration v57 — bundle payload −72% to −75%  
**Related:** [STOREFRONT_PAYLOAD_AUDIT_REPORT.md](./STOREFRONT_PAYLOAD_AUDIT_REPORT.md)

---

## Capacity impact model

Payload reduction improves **connection turnover**, **JSON CPU**, and **network bandwidth** — not raw Postgres QPS alone.

| Factor | Multiplier | Notes |
|--------|------------|-------|
| JSON serialize CPU | **1.4×** headroom | Grid vs full projection |
| Connection hold duration | **1.2×** faster release | Smaller responses |
| Wire bytes (origin) | **4×** efficiency | 62 KB → 16 KB |
| Edge cache density | **3.5×** more bundles/MB | Same worker memory |

---

## Concurrent user capacity (estimates)

| Scenario | Before v57 | After v57 | Delta |
|----------|------------|-----------|-------|
| **Comfortable (0% errors)** | ~1,500 | **~1,800–2,000** | +20–33% |
| **Degraded (<10% errors)** | ~2,500 | **~3,000–3,500** | +20–40% |
| **1000-user error rate** | **86%** | **2–8%** (with pooler) | −78 to −96 pp |
| **1000-user P95** | 12,000 ms | **800–2,500 ms** | −79 to −93% |
| **Storefront req/s @ 500 users** | ~996 | **~1,100–1,300** | +10–30% |

### Combined with existing stack (v41 + v48 + v56 edge)

| Tier | Capacity |
|------|----------|
| Safe operating | **~1,200 → ~1,500** concurrent |
| Stress ceiling | **~2,500 → ~3,200** concurrent |
| Target 5,000 stress | Still needs CDN + pooler + edge (see LOAD_TEST_5000_AR.md) |

---

## Load test comparison template

| Phase | Users | Req/s | Err% | P50 | P95 | Notes |
|-------|-------|-------|------|-----|-----|-------|
| **Before v57** | 500 | 996 | 0% | — | — | User-reported |
| **Before v57** | 1000 | — | **86%** | — | **12000** | User-reported |
| **After v57** | 500 | ___ | ___ | ___ | ___ | Run post-deploy |
| **After v57** | 1000 | ___ | ___ | ___ | ___ | Run post-deploy |

```bash
npm run db:deploy
npm run load:test -- --users=500 --duration=30 --slug=YOUR_SLUG
npm run load:test -- --users=1000 --duration=45 --slug=YOUR_SLUG
```

---

## Verdict

v57 delivers **≥70% payload reduction** and an estimated **+20–40% effective concurrent capacity** for storefront reads. The **86% → <10% error** improvement at 1000 users requires **v57 + Supavisor pooler**; payload alone does not fix pool exhaustion but is a necessary component.

**Expected capacity increase score: +25% comfortable envelope**
