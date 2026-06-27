# Platform Architecture

**Last updated:** 2026-06-19  
**Stack:** React 18 · Vite · Supabase · PostgreSQL · Tailwind/shadcn

This document defines how the codebase is organized and how new code should be written.

---

## Layer model

```
pages/          Route screens — compose hooks + components, minimal logic
  ↓
hooks/          React state, effects, realtime subscriptions
  ↓
services/       Supabase / RPC / cache — sole DB access layer for features
  ↓
mappers/        Row → domain object transforms
lib/            Infrastructure (cache, auth, realtime, observability)
utils/          Pure functions (no Supabase imports)
types/          Shared TypeScript types
data/           Static config only (plans, form options)
integrations/   Supabase client + generated types + RPC helper
```

**Rule:** Pages and components do **not** call `supabase.from()` or `.rpc()` directly. Use a service (or hook that calls a service).

**Exceptions:** Auth session (`AuthContext`), fire-and-forget analytics (`useStoreVisitTracking`, `useProductViewTracking`), admin auth pages.

---

## Folder structure

| Path | Purpose |
|------|---------|
| `src/components/ui/` | shadcn primitives — lowercase filenames |
| `src/components/{feature}/` | Feature UI (orders, products, storefront, …) |
| `src/pages/` | Merchant routes |
| `src/pages/admin/` | Platform admin routes |
| `src/services/` | One file per domain: `*Service.ts` |
| `src/hooks/` | `use*.ts` (prefer `.ts` unless file contains JSX) |
| `src/context/` | React providers |
| `src/lib/` | Cross-cutting infrastructure |
| `src/utils/` | Pure helpers |
| `src/mappers/` | DB → domain mapping |
| `src/data/` | Static JSON-like config — see `src/data/README.md` |

---

## Naming conventions

| Artifact | Convention | Example |
|----------|------------|---------|
| Service file | `{domain}Service.ts` | `orderService.ts` |
| Hook file | `use{Feature}.ts` | `useMerchantProductsPage.ts` |
| Component | PascalCase | `OrdersDataTable.tsx` |
| UI primitive | lowercase | `button.tsx` |
| Mapper | `mapDb{Entity}` | `mapDbProduct` |
| Cache key | `CacheKeys.{entity}(ownerId)` | `CacheKeys.products(ownerId)` |
| RPC arg | `p_{snake_case}` | `p_owner_id` |

---

## Services

### Import path

Always import from the concrete service file:

```typescript
import { fetchOrdersFiltered } from '@/services/orderService';
```

Barrel `services/index.ts` exists for discoverability but direct imports are preferred in application code.

### Service inventory

| Service | Scope | Access pattern |
|---------|-------|----------------|
| `productService` | Merchant catalog | Cache + `.from()` + lifecycle |
| `productsCrudService` | Typed product CRUD | `.from('products')` |
| `orderService` | Orders | RPC-first + fallback |
| `storeService` | Store settings / bootstrap | `.from()` + RPC |
| `storefrontProductService` | Public catalog | Slug-scoped RPC |
| `statisticsService` | Analytics page | RPC + capped fetches |
| `dashboardStatsService` | Dashboard KPIs | Batch RPC |
| `inventoryService` | Stock restock | RPC |
| `marketingService` | Marketing reads | RPC |
| `couponService` | Checkout coupons | RPC |
| `deliveryService` | Delivery fees | RPC |
| `paymentService` | Payment/refunds | RPC |
| `leadAdminService` | Platform admin | Admin RPCs |
| `merchantHydration` | Post-login load | Orchestration |

### Error handling standard

Services return one of:

- `{ success: boolean; error?: string }` — mutations
- `T | null` — reads with graceful degradation
- Custom error class — when caller must branch (`InventoryRestockError`, `LeadSubmitError`)

UI layers (hooks/pages) show `toast` / `useToast` — services stay UI-free.

### Tenant scoping

| Context | Key |
|---------|-----|
| Merchant dashboard | `owner_id` (explicit param on every service call) |
| Public storefront | `store_slug` via RPC |
| Platform admin | `is_platform_admin` RPC + RLS |

**Migration in progress:** `data/dummyData.ts` still uses module-level `setCurrentOwner()` — new code must pass `ownerId` explicitly.

---

## Hooks

| Pattern | Example |
|---------|---------|
| Data fetching | `useMerchantProductsPage` → `productService` |
| Realtime | `useRealtimeProducts` → `merchantRealtimeHub` (never raw channels) |
| Form logic | `useAddProductForm` → `productService` |
| Dashboard KPIs | `useOrderDashboardStats` → `dashboardStatsService` |

Hooks hold refs for callbacks to avoid resubscribing realtime channels.

---

## Database access

### Priority order

1. **RPC** — aggregated, tenant-safe, indexed (`get_store_statistics`, `list_merchant_orders`)
2. **`.from()` with explicit filters** — `owner_id=eq.{id}` or slug RPC resolution
3. **Never** implicit tenant from module state in new code

### RPC wrapper

Use `src/integrations/supabase/rpc.ts` → `callSupabaseRpc()` inside services (not in UI).

### Caching

`src/lib/cache.ts` is the server-state cache:

- `CacheKeys` — namespaced keys
- `CacheTTL` — fresh / stale windows
- `dedup()` — in-flight coalescing
- `flushOrderCache(ownerId)` — order + analytics invalidation
- `invalidateOwnerCache(ownerId)` — full merchant reset

React Query is installed but **not used** for data fetching — custom cache is canonical until a deliberate migration.

---

## Components

- **Feature components** live under `components/{feature}/`
- **Pages** use `DashboardLayout` + `PageHeader` for merchant screens
- **Storefront** uses `StorefrontRouteShell` + `TenantStoreProvider`
- Root-level components (`CategoryDialog`, `CartDrawer`) are shared — prefer feature folders for new work

---

## Realtime

Single hub: `src/lib/merchantRealtimeHub.ts`

- One channel per table per merchant
- Cache patching centralized in hub
- Hooks register UI callbacks only

---

## Refactors completed (2026-06-19)

| Change | Why |
|--------|-----|
| `Settings.tsx` → `storeService` | Eliminated duplicate `store_settings` access |
| `CategoryDialog` → `productService` | Category CRUD + cache invalidation |
| `useAddProductForm` → `getCategories()` | Removed direct categories query |
| `useDashboardInsights` → `dashboardStatsService` | Removed hook-level RPC |
| `useTenantStore` shim removed | Import from `@/context/TenantStoreContext` |
| `productCacheSync` → `productService` | No direct `dummyData` imports |
| `integrations/supabase/rpc.ts` | RPC wrapper for services |

---

## Roadmap (technical debt)

1. **Migrate `dummyData.ts`** → `services/merchantProductCatalog.ts` with explicit `ownerId`
2. **Marketing admin writes** — move `CouponsTab` / `ProductDiscountsTab` Supabase calls into services
3. **Unify StatCard** — merge `statistics/StatCard` and `ui/StatCard`
4. **Typed RPCs** — extend generated types for all RPC signatures
5. **React Query decision** — adopt or remove `@tanstack/react-query`
6. **Single toast system** — standardize on Sonner

See also: `CODE_CLEANUP_REPORT.md`, `supabase/REALTIME_AUDIT.md`, `supabase/ANALYTICS_SYSTEMS_AUDIT.md`.
