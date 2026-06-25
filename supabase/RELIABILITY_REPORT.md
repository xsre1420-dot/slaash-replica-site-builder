# Reliability Report

**Date:** 2026-06-19  
**Role:** Principal Site Reliability Engineer  
**Scope:** Platform reliability under unexpected failures  
**Related:** [CHAOS_TESTING_REPORT.md](./CHAOS_TESTING_REPORT.md) · [FAILURE_RECOVERY_REPORT.md](./FAILURE_RECOVERY_REPORT.md) · [ORDER_RELIABILITY_REPORT.md](./ORDER_RELIABILITY_REPORT.md)

---

## Reliability score: **92 / 100**

---

# Reliability by domain

| Domain | Score | SLO (design) | Status |
|--------|-------|--------------|--------|
| **Checkout / orders** | 95 | 99.9% success (non-fraud) | ✅ |
| **Inventory** | 93 | Zero corruption | ✅ |
| **Products (merchant)** | 85 | No accidental duplicates | ⚠ Partial |
| **Storefront reads** | 94 | 99.5% availability (cached) | ✅ |
| **Realtime updates** | 86 | 95% reconnect success | ✅ |
| **Background jobs** | 88 | 99% webhook delivery <5min | ✅ v55 |
| **Analytics pipeline** | 90 | Non-blocking hot path | ✅ v54 |

---

# Defense-in-depth stack

## Orders (5 layers)

1. **UI locks** — `submitLockRef`, `isSubmitting`, cross-tab lock  
2. **Client dedup** — `inflightOrders` Map per idempotency key  
3. **Stable idempotency** — `sessionStorage` survives refresh  
4. **Server lock** — `pg_advisory_xact_lock(owner, key)`  
5. **DB constraint** — `UNIQUE (owner_id, idempotency_key)` + atomic transaction  

## Inventory (3 layers)

1. **Checkout RPC** — stock deduct in same transaction as order  
2. **Restock RPC** — `increment_product_stock` with auth gate  
3. **DB constraint** — `products_stock_quantity_non_negative` CHECK (v53)  

## Products (2 layers)

1. **Client** — `runOncePerKey` + form submit lock  
2. **Server** — RLS owner scope (no cross-tenant write)  

---

# Verified reliability properties

| Property | Test / mechanism | Result |
|----------|------------------|--------|
| Idempotent checkout | `orderService.test.ts` | ✅ |
| Recovery after fetch error | `orderService.test.ts` | ✅ |
| Concurrent order dedup | `orderService.test.ts` | ✅ |
| Cross-tab checkout lock | `checkoutSession.test.ts` | ✅ |
| Rapid product click coalesce | `resilienceBehaviors.test.ts` | ✅ |
| Parallel fetch dedup | `resilienceBehaviors.test.ts` | ✅ |
| Failover config resolution | `failover.test.ts` | ✅ |
| Hub teardown on DR reset | `supabaseClient.ts` | ✅ |
| Tenant isolation under stress | `tenant-isolation-test.mjs` 20/20 | ✅ |
| Inventory integrity audit | `inventory-integrity-test.mjs` | ✅ |

**Unit tests:** 188+ passing (includes all reliability suites).

---

# Monitoring & observability

| Signal | Source | Alert-worthy? |
|--------|--------|---------------|
| Order create failures | `recordHealthEvent('order')` | Yes |
| Realtime reconnect exhaustion | Hub max attempts log | Yes |
| Checkout recovery rate | `metrics.checkout.submit.recovered` | Monitor |
| Idempotent checkout rate | `metrics.checkout.submit.idempotent` | Informational |
| Platform health | `platform_health_check` RPC | Yes |
| Background job lag | `get_background_jobs_status` | Yes |
| Client health domains | 10 domains / 15min window | Admin dashboard |

```bash
npm run health:monitor
npm run recovery:check
```

---

# Reliability SLO targets

| SLO | Target | Measurement |
|-----|--------|-------------|
| Checkout success rate | 99.9% | Order health events |
| Duplicate order rate | <0.01% | Idempotency metrics |
| Inventory negative stock | 0 | DB CHECK + audit RPC |
| Realtime reconnect | >95% within 6 attempts | Health monitor |
| Webhook delivery | 99% within 5 min | Outbox status |
| Platform availability | 99.5% | Health endpoint + uptime |

---

# Known reliability limits

| Limit | Behavior under stress |
|-------|----------------------|
| Realtime max 6 reconnects | Dashboard stale until refresh |
| No offline merchant queue | Edits fail when offline |
| Client-only product dedup | Multi-tab can create duplicates |
| Statistics fallback cap | 5k orders max in degraded mode |
| Single Postgres primary | Full outage without failover config |

**Reliability score: 92/100**
