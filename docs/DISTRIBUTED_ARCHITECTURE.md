# Distributed Architecture

Architecture preparation for horizontal scaling (10K–100K+ concurrent users). No cloud-provider coupling — enable infrastructure via environment variables only.

## Layers

```
Browser (L0) → CDN (L1) → Edge Functions (L2) → App Instances (L3) → Read Replica / Primary (L4)
                      ↘ KV Cache (L2 shared) ↗
```

## Stateless Application Servers

- **No server-side session state** in the SPA — auth via Supabase JWT.
- **Per-instance L1 cache** (`src/lib/cache`) — expected; optional **L2 KV** (`VITE_KV_REST_*`) for cross-instance coherence.
- **Worker identity** (`getWorkerInstanceId`) — metrics only, not leader election.
- **Background jobs** — client queues persist to IndexedDB; server work uses PostgreSQL outboxes with `FOR UPDATE SKIP LOCKED` claim batches.

## Read / Write Separation

| Path | Router | Target |
|------|--------|--------|
| Storefront reads | `callReadRpc` → `readRouting.ts` | Edge → Read Replica → Primary |
| Checkout writes | `callWriteRpc` | Primary only |
| Dashboard stats | `callReadRpc` | Read Replica (when configured) |
| Workers | service_role RPC | Primary |

Configure: `VITE_SUPABASE_READ_REPLICA_URL`

## Queue Scaling

- **Isolated queue kinds** — analytics/import cannot exhaust orders queue concurrency.
- **Idempotency** — L1 in-process + optional KV L2 + DB unique constraints on outboxes.
- **Horizontal workers** — scale `process-background-queue` edge invocations and cron; each claims exclusive batches.

## Service Boundaries

Defined in `src/core/distributed/serviceBoundaries.ts` — maps to `src/modules/*` for future extraction:

- Storefront, Checkout, Analytics, Notifications, Imports, Search, Background Processing

## Failure Isolation

- **Best-effort subsystems** (analytics, notifications, imports) use `safeEnqueueBestEffort` — never throw into checkout path.
- **Circuit breakers** on RPC layer with read-replica → primary fallback.
- **Separate queues** prevent head-of-line blocking.

## Cache Strategy

See `src/core/distributed/cacheStrategy.ts` for tier TTLs, version keys, and invalidation modes.

## Audits

```bash
npm run audit:distributed-scaling   # static codebase audit
npm run db:scaling-test             # live RPC probes (requires .env)
npm run db:capacity-projection      # capacity model CLI
```

## Future Infrastructure (env-only)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_READ_REPLICA_URL` | Read replica routing |
| `VITE_SUPABASE_POOLER_URL` | Connection multiplexing |
| `VITE_KV_REST_URL` / `VITE_KV_REST_TOKEN` | Shared L2 cache + distributed idempotency |
| `VITE_STOREFRONT_EDGE_ENABLED` | Edge storefront cache |
| `VITE_CDN_BASE_URL` | Static/media CDN |
| `VITE_FAILOVER_SUPABASE_URL` | DR failover |

Apply migration v80: `supabase/migrations/20260630000001_distributed_scaling_v80.sql`
