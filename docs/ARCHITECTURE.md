# Platform Architecture

Enterprise-grade layered architecture for the multi-tenant SaaS commerce platform.

## Layer Model

```
┌─────────────────────────────────────────────────────────┐
│  UI — pages, components, hooks                          │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Modules (src/modules/*) — domain public APIs           │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Services — read / write / facades (business logic)     │
│  src/services/read/*  src/services/write/*  *Service.ts  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Repositories (src/repositories/*) — Supabase I/O only  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Integrations — client, RPC, read/write routing         │
└─────────────────────────────────────────────────────────┘
```

Background work runs through `src/background/` (queues, processors, scheduler) and is enqueued via `@/background/enqueue`.

## Folder Purposes

| Path | Purpose |
|------|---------|
| `src/modules/` | Domain module barrels — stable import surface per bounded context |
| `src/services/read/` | Read-only queries, caching, aggregation |
| `src/services/write/` | Mutations, cache invalidation, outbox enqueue |
| `src/services/*Service.ts` | Legacy facades — preserve API compatibility |
| `src/repositories/` | Table accessors and RPC wrappers — no business logic |
| `src/core/` | Cross-cutting infrastructure (errors, logging helpers) |
| `src/config/` | Env, feature flags, application constants |
| `src/background/` | Job queues, processors, retry, monitoring |
| `src/lib/` | Shared utilities (cache, observability, read/write clients) |
| `src/integrations/supabase/` | Generated types, client singleton, RPC helpers |

## Domain Modules

| Module | Responsibility |
|--------|----------------|
| **Orders** | Order lifecycle, workflow tabs, customer insights |
| **Products** | Catalog CRUD, publishing, idempotency |
| **Store** | Settings, compliance, custom domains, bootstrap |
| **Inventory** | Stock levels, restock, movements |
| **Marketing** | Coupons, campaigns, attribution |
| **Delivery** | Governorate pricing, delivery fees |
| **Storefront** | Public product reads, cache tiers, edge |
| **Checkout** | Order creation, payment, recovery |
| **Customers** | Customer profiles, order history |
| **Analytics** | KPIs, tracking, dashboard batch |
| **Auth** | Sessions, profiles, access codes |
| **Background** | Async jobs, cache invalidation, outbox |

Import from modules for new code:

```typescript
import { Orders } from '@/modules';
await Orders.Read.fetchOrdersFiltered(ownerId, filters);
```

## Read / Write Flow

- **Reads** route through `callReadRpc` / read replicas where configured (`src/lib/readWrite/readClient.ts`).
- **Writes** route through `callWriteRpc` / primary DB (`src/lib/readWrite/writeClient.ts`).
- Facades (`orderService.ts`, `productService.ts`, etc.) delegate to read or write services without exposing Supabase.

## Data Flow (Order Example)

1. UI hook calls `OrderService.fetchOrdersFiltered`.
2. Facade delegates to `orderReadService.fetchOrdersFiltered`.
3. Read service checks cache, calls `callReadRpc('list_merchant_orders')` via repository.
4. Mapper transforms DB rows → domain `Order` type.
5. Optional image enrichment via `productRepository.productsTable()`.

Write path:

1. UI calls `OrderService.createOrder`.
2. `orderWriteService` validates, calls `orderRepository.rpcCreateOrderWithStockDeduction`.
3. On success: cache flush + `enqueueCacheInvalidation` via background queue.

## Background Jobs

| Queue | Examples |
|-------|----------|
| `cache-invalidation` | Storefront/settings cache bust after mutations |
| `analytics` | Deferred tracking, batch flush |
| `outbox` | Reliable side-effects |

Processors live in `src/background/processors/`. Enqueue via `@/background/enqueue` — never `void` fire-and-forget from services.

## Error Handling

Central model in `src/core/errors/`:

- `AppError` — domain, code, userMessage
- `normalizeError`, `fromRpcFailure`, `logError`
- Domain mappers remain in `utils/` (order, product, payment)

## Configuration

Single import: `@/config`

- `env` — environment detection
- `features` — feature flags from env vars
- `APP_CONSTANTS` — pagination, import thresholds

## Conventions

1. **No direct Supabase in read/write services** — use repositories.
2. **Legacy top-level services** may still access Supabase; migrate incrementally.
3. **UI never imports** `@/integrations/supabase/client`.
4. **Preserve facade exports** — external API compatibility is mandatory.
5. **Business logic stays in services** — repositories are thin I/O only.

## Testing

```bash
npm run typecheck
npm run test
npm run audit:enterprise-architecture
npm run audit:read-write
npm run audit:background-jobs
```
