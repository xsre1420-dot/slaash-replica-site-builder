# Reliability Monitoring Report

**Date:** 2026-06-19  
**Companion:** [`HEALTH_MONITORING_REPORT.md`](./HEALTH_MONITORING_REPORT.md) · [`RESILIENCE_REPORT.md`](./RESILIENCE_REPORT.md)

---

## Reliability score: **90 / 100**

Monitoring does not change underlying resilience; it **improves mean time to detect (MTTD)**.

| Layer | Reliability | Monitoring coverage |
|-------|-------------|---------------------|
| Checkout / orders | 95/100 | **Full** — checkout + order domains, critical alerts |
| Product lifecycle | 88/100 | **Partial** — create/publish tracked; bulk import not yet |
| Auth | 84/100 | **Full** — login/register failure counters |
| Inventory | 93/100 | **Full** — restock RPC failures |
| Database | 88/100 | **Full** — RPC probe, slow queries, schema health |
| Realtime | 85/100 | **Improved** — reconnect exhaustion tracked |
| Disaster recovery | 82/100 | **Existing** — `useRecoveryMonitor`, failover |

---

## Failure mode → detection map

| Failure mode | Detection | Recovery |
|--------------|-----------|----------|
| Duplicate order attempt | Idempotency (existing) | N/A — prevented |
| Checkout network blip | `checkout` failure + recovery metric | `tryRecoverCheckoutOrder` |
| Product create DB error | `product.create` health event | User retry |
| Publish RPC missing | `product.publish` + schema health | `db:deploy` |
| Login brute force / outage | `auth.login` spike alert | Rate limit (Supabase) |
| Stock restock RPC fail | `inventory` event | User retry |
| DB connection loss | DR monitor + `database` events | Failover optional |
| Realtime silent disconnect | Hub `maxAttemptsExceeded` | Page refresh |
| Schema migration lag | `platform_health_check` | `PlatformDbStatusBanner` |

---

## Alerting matrix

| Condition | Severity | Owner action |
|-----------|----------|--------------|
| 5+ client errors / 60s | Critical | Check webhook logs |
| 3+ checkout failures / 5 min | Critical | Inspect stock, RPC, rate limits |
| 5+ DB failures / 1 min | Critical | Check Supabase status, connections |
| 5+ product create / 10 min | Warning | Schema? Image upload? |
| 15+ login failures / 5 min | Warning | Auth outage or attack |
| Realtime max reconnect | Warning | Supabase Realtime quota / network |

---

## Recommended SLOs (suggested)

| SLO | Target | Measurement |
|-----|--------|-------------|
| Checkout success rate | ≥ 99.5% | `checkout.success / (success + failure)` |
| Order RPC availability | ≥ 99.9% | `health:monitor` + synthetic |
| Dashboard load | p95 &lt; 300ms | `get_dashboard_statistics_batch` timing |
| Schema version match | 100% prod | `platform_health_check.ok` |
| Mean time to detect outage | &lt; 5 min | Synthetic + webhook alerts |

---

## Conclusion

The platform now has **end-to-end client observability** from user action through health dashboard. Production hardening requires **server-side aggregation** of webhook events and **scheduled synthetic probes** — client session metrics alone are insufficient for fleet SLOs.

**Next step:** Deploy `npm run health:monitor` in CI/cron against staging after each `db:deploy`.
