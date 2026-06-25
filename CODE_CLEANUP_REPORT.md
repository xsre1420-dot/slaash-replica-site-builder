# Code Cleanup Report — Removed Files

**Date:** 2026-06-25  
**Scope:** Full codebase dead-code audit, safe refactor, dependency trim  
**Verification:** `npm run typecheck` ✅ · `npm test` ✅ (132 tests)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Files removed (cumulative)** | **54** |
| **This session** | **10** (8 UI + 1 duplicate StatCard + 1 barrel) |
| **npm packages removed (cumulative)** | **7 direct** |
| **Estimated LOC removed** | **~110 KB** source |
| **Maintainability score** | **88 / 100** (see `TECHNICAL_DEBT_REPORT.md`) |

---

## This Session — Removed Files

### Unused shadcn UI (8) — never imported outside `ui/`

| File | Size | Reason |
|------|------|--------|
| `src/components/ui/sidebar.tsx` | ~24 KB | Zero external imports; pulled unused Radix deps |
| `src/components/ui/separator.tsx` | ~0.8 KB | Only used by deleted sidebar |
| `src/components/ui/toggle.tsx` | ~1.5 KB | Only used by deleted toggle-group |
| `src/components/ui/toggle-group.tsx` | ~1.8 KB | Zero external imports |
| `src/components/ui/form.tsx` | ~4.3 KB | Only consumer of `react-hook-form` |
| `src/components/ui/breadcrumb.tsx` | ~2.8 KB | App uses inline breadcrumbs in `PageHeader` |
| `src/components/ui/pagination.tsx` | ~2.9 KB | Pages use custom `OrdersPagination` |
| `src/components/ui/scroll-area.tsx` | ~1.7 KB | Zero external imports |

### Duplicate component (1)

| File | Reason |
|------|--------|
| `src/components/statistics/StatCard.tsx` | Superseded by `src/components/ui/StatCard.tsx` (used by Dashboard, Products, Orders, Inventory) |

### Dead barrel export (1)

| File | Reason |
|------|--------|
| `src/services/index.ts` | Zero `@/services` barrel imports; all consumers use `@/services/{module}` |

### Hooks (1)

| File | Reason |
|------|--------|
| `src/hooks/use-mobile.tsx` | Only used by deleted `sidebar.tsx` |

---

## Prior Pass — Already Removed (2026-06-19)

### Hooks (4)

- `useParallax.tsx`, `useOfflineQueue.tsx`, `useProductFiltering.ts`, `useTenantStore.tsx` (superseded by `TenantStoreContext`)

### Pages (1)

- `Signup.tsx` — `/signup` routes to `RequestAccess`

### Components (18)

- Legacy orders UI: `OrdersSimpleTable`, `OrdersTable`, `OrdersEmptyState`, `OrdersHeader`, `OrdersFilters`
- Orphaned: `StoreHeader`, `CategoryManagement`, `Footer`, `ColorsManager`
- Settings: `SettingsHeader`, `SettingsActions`
- Add product: `FormSection` → `ProductFormSection`
- Product details: `ProductInfo`, `AddToCartButton`
- Order details: `StatusBadge`, `OrderHeader`, `OrderDetailsPageHeader`
- UI: `AttentionZone`, `chart`, `command`, `drawer`, `resizable`, `input-otp`, `context-menu`, `aspect-ratio`, `hover-card`, `menubar`, `navigation-menu`, `radio-group`

### Utils / lib (6)

- `exportProducts.ts` → `productExportUtils.ts`
- `lib/auth.ts`, `cache/redisAdapter.ts`, `plugins/registry.ts`, `themes/registry.ts`, `design-system/tokens.ts`
- `mappers/index.ts`

---

## npm Dependencies Removed

| Package | Reason |
|---------|--------|
| `react-hook-form` | Only used by deleted `form.tsx` |
| `@hookform/resolvers` | Same |
| `@radix-ui/react-scroll-area` | Deleted `scroll-area.tsx` |
| `@radix-ui/react-separator` | Deleted `separator.tsx` / `sidebar.tsx` |
| `@radix-ui/react-toggle` | Deleted `toggle.tsx` |
| `@radix-ui/react-toggle-group` | Deleted `toggle-group.tsx` |
| `@tailwindcss/typography` | Not configured in `tailwind.config.ts` |

**Kept:** `zod` (used by `lib/env.ts`), `lovable-tagger` (dev workflow in `vite.config.ts`)

**Build:** `vite.config.ts` — `vendor-forms` chunk renamed to `vendor-validation` (`zod` only)

---

## Standardization Applied

| Pattern | Standard |
|---------|----------|
| Service imports | `@/services/{module}` — no barrel |
| Mapper imports | `@/services/orderMapper` etc. — no barrel |
| Tenant store | `@/context/TenantStoreContext` only |
| Stat cards | `@/components/ui/StatCard` |
| Product export | `@/utils/productExportUtils` |
| Auth utilities | `@/lib/authUtils` + `@/lib/authSession` — not legacy `auth.ts` |
| Breadcrumbs | `PageHeader` inline props — not shadcn `breadcrumb` |

---

## Not Removed (Intentional)

| Item | Why kept |
|------|----------|
| `src/data/dummyData.ts` | Still backs `productService` cache layer — migration in progress |
| `lovable-tagger` | Active dev plugin |
| `supabase/apply-*.sql` | Documented as stale; ops review before delete |
| `src/lib/disasterRecovery/*` | Used by `RecoveryBanner`, failover tests |
| All 20 service modules | Actively imported |
| All routed pages | Verified in `App.tsx` |

---

## Verification

```bash
npm run typecheck   # ✅
npm test            # ✅ 132 passed
```

Run `npm install` after pulling to sync `package-lock.json` with removed dependencies.
