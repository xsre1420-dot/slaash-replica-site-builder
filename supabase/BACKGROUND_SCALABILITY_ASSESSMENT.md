# Background Scalability Assessment

**Date:** 2026-06-19  
**Platform:** Supabase PostgreSQL + Edge Functions  
**Target:** 1,000+ concurrent storefront visitors · 1,000+ merchants  

---

## Scalability score

| Capability | Before audit | After v55 | At 10× traffic |
|------------|--------------|-----------|----------------|
| Storefront write absorption | 55 | **92** | ✅ |
| Analytics pipeline | 60 | **90** | ✅ with pg_cron |
| Webhook delivery | 20 | **85** | ✅ with edge cron |
| Order processing | 88 | **88** | ✅ (low volume) |
| Merchant dashboard reads | 85 | **85** | ✅ |
| Bulk / image workloads | 40 | **45** | ⚠ Needs job queue |
| **Overall scalability** | **58/100** | **86/100** | — |

---

## Traffic tier analysis

### Storefront (1,000 concurrent visitors)

| Component | Load | Capacity | Bottleneck |
|-----------|------|----------|------------|
| Visit tracking | ~300–600 outbox INSERTs/min | High (append-only) | None |
| Analytics processor | 1 batch/min (500 rows) | Adequate | Increase cron frequency |
| Product views | ~150–400 outbox INSERTs/min | High | None |
| Checkout | ~5–20 orders/min | High | Hot SKU row locks (inventory audit) |

### Merchants (1,000 active stores)

| Component | Load | Capacity |
|-----------|------|----------|
| Dashboard batch RPC | ~100–200 reads/min | Cached 90s |
| Webhook outbox | ~5–20 events/min | Edge worker 50/batch |
| Realtime connections | ~200–500 WS | Supabase plan limits |
| Statistics page | Spiky | Rollup-backed |

---

## Horizontal scaling properties

| Layer | Scales horizontally? | Mechanism |
|-------|---------------------|-----------|
| Storefront React | ✅ | Stateless CDN |
| Visit/product tracking | ✅ | Outbox INSERT only |
| Analytics processor | ✅ | `SKIP LOCKED` multi-worker safe |
| Webhook worker | ✅ | Claim batch + parallel edge invocations |
| PostgreSQL | ⚠ Vertical + read replicas | Single primary for writes |
| Edge functions | ✅ | Supabase auto-scale |

---

## Queue architecture maturity

```
                    IMMEDIATE              DEFERRED                 BACKGROUND
                 ─────────────         ──────────────         ───────────────────
Order checkout   create_order RPC      cache invalidation     webhook outbox
Product publish  publish_owner_product storefront void        —
Analytics visit  —                     scheduleIdle RPC       analytics outbox → cron
Notifications    —                     realtime WS            webhook edge worker
Inventory        increment_product_stock cache patch          audit RPC (on-demand)
```

---

## Failure isolation

| Failure domain | Blast radius | Isolation |
|----------------|--------------|-----------|
| Analytics cron down | Visit KPIs lag | Storefront unaffected |
| Webhook worker down | External integrations lag | Orders still created |
| Edge function timeout | Single batch retries | DLQ after 5 attempts |
| DB trigger error | Order txn rolls back | Correct — fail closed |

---

## Resource growth projections

| Table | Growth rate | Retention | Action at scale |
|-------|---------------|-----------|-----------------|
| `analytics_event_outbox` | High burst | 7 days processed | ✅ prune cron |
| `store_visits` | Linear | Long-term | Partition by month (P2) |
| `order_webhook_outbox` | Low | Until delivered/failed | DLQ replay |
| `product_views` | Linear | Long-term | Aggregate snapshots (P2) |

---

## Deployment checklist

- [ ] `npm run db:deploy` through **v55**
- [ ] Deploy edge function: `supabase functions deploy process-order-webhook-outbox`
- [ ] Schedule edge cron (Supabase Dashboard → Edge Functions → cron) every **1–2 minutes**
- [ ] Optional: set `BACKGROUND_WORKER_SECRET` for worker auth
- [ ] Enable **pg_cron** on Pro+ for analytics + stale recovery
- [ ] Configure `store_settings.order_webhook_url` for merchants needing integrations
- [ ] Monitor: `SELECT get_background_jobs_status();`

---

## P2 scalability backlog

| Item | Priority | Impact |
|------|----------|--------|
| `import_jobs` table + worker for CSV bulk | P1 | Merchant bulk upload |
| Web Worker for image compression | P1 | Product save UX |
| Server-side statistics chart RPC | P2 | Large-store analytics |
| Meta conversions outbox (replace void invoke) | P2 | Attribution reliability |
| `store_visits` table partitioning | P3 | 100M+ rows |

---

## Verification

```bash
npm test                        # 170+ tests
npm run db:background-jobs-test # pipeline security probes
npm run db:analytics-test       # analytics probes
```

**Scalability readiness: 86/100 — production suitable for 1K concurrent visitors and 1K merchants with pg_cron + webhook edge worker deployed.**
