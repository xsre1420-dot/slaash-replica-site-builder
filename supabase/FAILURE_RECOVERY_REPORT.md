# Failure Recovery Report

**Date:** 2026-06-19  
**Role:** Principal SRE · Chaos Testing Specialist  
**Related:** [CHAOS_TESTING_REPORT.md](./CHAOS_TESTING_REPORT.md) · [RELIABILITY_REPORT.md](./RELIABILITY_REPORT.md)

---

## Recovery score: **90 / 100**

---

# Recovery architecture

```
FAILURE                    DETECTION              RECOVERY ACTION
─────────────────────────────────────────────────────────────────
Network blip on checkout   RPC error class        3× retry (400ms×n)
                           Still failing          get_order_by_idempotency_key
Browser refresh mid-submit sessionStorage key     tryRecoverCheckoutOrder on mount
Duplicate submit click   inflightOrders Map     Return same promise
Cross-tab submit         localStorage lock      Block second tab
Realtime WS drop         CHANNEL_ERROR          Exponential backoff (1s→30s)
Max realtime retries     6 attempts exhausted   User refresh re-subscribes
Primary DB unreachable   Health check fail      activateFailover() (optional)
Logout / auth reset      AuthContext            teardownMerchantRealtimeHub()
Webhook delivery fail    Outbox status=failed   retry_order_webhook_events (v55)
Analytics write spike    Hot path timeout       Outbox INSERT only (v54)
```

---

# Recovery mechanisms by layer

## Client layer

| Mechanism | File | Trigger | Outcome |
|-----------|------|---------|---------|
| Order inflight dedup | `orderService.ts` | Concurrent createOrder | Single RPC |
| Network retry (3×) | `orderService.ts` | Retryable errors | Eventual success or recovery |
| Checkout recovery | `checkoutRecoveryService.ts` | Post-transport failure | Idempotent order return |
| Idempotency key | `checkoutSession.ts` | Session-scoped checkout | Stable key across refresh |
| Cross-tab lock | `checkoutSession.ts` | Parallel tab submit | One tab wins |
| Submit locks | Checkout UI hooks | Rapid clicks | Blocked UI state |
| Product create lock | `productCreateLock.ts` | Rapid add product | Coalesced insert |
| Cache dedup | `cache.ts` | Parallel slow fetches | One origin request |
| Realtime reconnect | `merchantRealtimeHub.ts` | WS disconnect | Auto resubscribe |
| Hub teardown | `merchantRealtimeHub.ts` | Logout / failover | No channel leak |
| Failover switch | `failover.ts` | DR activation | Alternate Supabase URL |
| Health monitor | `healthMonitor.ts` | Domain failures | Sliding window events |

## Server layer

| Mechanism | Trigger | Outcome |
|-----------|---------|---------|
| Advisory lock | Concurrent same idempotency key | Serialized |
| UNIQUE constraint | Duplicate idempotency insert | Return existing order |
| Atomic checkout RPC | Any failure mid-transaction | Full rollback |
| `get_order_by_idempotency_key` | Client recovery probe | Order found / not found |
| Webhook outbox retry | Delivery failure | Exponential backoff |
| Stale webhook recovery | `recover_stale_webhook_processing` | Reclaim stuck rows |

---

# Recovery time objectives (design targets)

| Failure | Target recovery | Actual (design) |
|---------|-----------------|-----------------|
| Transient network (checkout) | <5s | 3 retries + recovery ≈ **2–4s** |
| Browser refresh mid-submit | Immediate on load | **<1s** recovery RPC |
| Realtime disconnect | <30s | Backoff max **30s** per attempt |
| Webhook delivery | <5 min | Cron + outbox **1–2 min** |
| Failover activation | Manual | **Minutes** (ops-dependent) |

---

# Graceful degradation

| Subsystem | Degraded mode | User impact |
|-----------|---------------|-------------|
| Realtime down | Cached data + manual refresh | Slightly stale dashboard |
| Analytics RPC slow | 90s stale cache | KPIs may lag |
| Storefront RPC slow | Edge + memory cache | Stale catalog up to 120s |
| Product fetch fail | Placeholder image | Visual only |
| Meta conversions fail | Fire-and-forget logged | No checkout impact |
| Statistics bundle missing | 5k-row client fallback | Slower, capped |

---

# Recovery gaps (P1–P2)

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| Realtime stops after 6 failures | Merchant must refresh | Add "Reconnect" UI button |
| No merchant offline write queue | Edits lost offline | P2 action queue |
| Product create no server idempotency | Multi-tab duplicate risk | P1 RPC idempotency key |
| Failover manual | Extended outage | Automated health-triggered failover |

**Failure recovery score: 90/100**
