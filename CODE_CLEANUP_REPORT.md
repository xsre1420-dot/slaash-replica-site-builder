# Code Cleanup Report

**Date:** 2026-06-19  
**Scope:** Dead code, unused files, duplicate utilities, unused dependencies  
**Verification:** `npm run typecheck` ✅ · `npm test` ✅ (132 tests)

---

## Summary

| Category | Removed | Kept (intentional) |
|----------|---------|-------------------|
| Files deleted | **44** | Active routes, storefront, merchant flows |
| Dead exports trimmed | **5** | Public service APIs still in use |
| npm packages removed | **11** (27 transitive) | All runtime deps still referenced |
| Estimated LOC removed | **~95 KB** source | — |

---

## 1. Files removed

### Hooks (3) — never mounted or imported

| File | Reason |
|------|--------|
| `src/hooks/useParallax.tsx` | Zero imports |
| `src/hooks/useOfflineQueue.tsx` | Never mounted; `OfflineBanner` uses `navigator.onLine` directly |
| `src/hooks/useProductFiltering.ts` | Documented for Store/PreviewStore but never wired; pages filter inline |

### Pages (1) — unreachable in production

| File | Reason |
|------|--------|
| `src/pages/Signup.tsx` | `/signup` routes to `RequestAccess` in `App.tsx`; page was test-only duplicate (~335 lines) |

**Test update:** `authPages.integration.test.tsx` now renders `RequestAccess` instead of deleted `Signup`.

### Components (18) — superseded or orphaned

| File | Reason |
|------|--------|
| `src/components/orders/OrdersSimpleTable.tsx` | Replaced by `OrdersDataTable` |
| `src/components/orders/OrdersTable.tsx` | Legacy table; unused |
| `src/components/orders/OrdersEmptyState.tsx` | Replaced by shared `EmptyState` |
| `src/components/orders/OrdersHeader.tsx` | Replaced by `PageHeader` |
| `src/components/orders/OrdersFilters.tsx` | Replaced by `OrdersToolbar` |
| `src/components/StoreHeader.tsx` | Zero imports |
| `src/components/CategoryManagement.tsx` | Replaced by `CategoryDialog` flow |
| `src/components/Footer.tsx` | Landing uses `LandingFooter` |
| `src/components/ColorsManager.tsx` | Replaced by `ColorSwatchPicker` |
| `src/components/settings/SettingsHeader.tsx` | Replaced by `PageHeader` |
| `src/components/settings/SettingsActions.tsx` | Zero imports |
| `src/components/add-product/FormSection.tsx` | Replaced by `ProductFormSection` |
| `src/components/product-details/ProductInfo.tsx` | Zero imports |
| `src/components/product-details/AddToCartButton.tsx` | Replaced by `CartButton` / inline actions |
| `src/components/order-details/StatusBadge.tsx` | Replaced by `OrderStatusBadges` |
| `src/components/order-details/OrderHeader.tsx` | Zero imports |
| `src/components/order-details/OrderDetailsPageHeader.tsx` | Replaced by `PageHeader` |
| `src/components/ui/AttentionZone.tsx` | Deprecated alias for `AttentionStrip`; zero imports |

### Unused shadcn UI primitives (11)

Never imported outside `src/components/ui/`:

- `chart.tsx` — statistics uses `recharts` directly via `SalesChart`
- `command.tsx`, `drawer.tsx`, `resizable.tsx`, `input-otp.tsx`
- `context-menu.tsx`, `aspect-ratio.tsx`, `hover-card.tsx`
- `menubar.tsx`, `navigation-menu.tsx`, `radio-group.tsx`

### Utils (1) — duplicate export path

| File | Reason |
|------|--------|
| `src/utils/exportProducts.ts` | Superseded by `productExportUtils.exportProductsToCsv` (used by `Products.tsx`) |

### Lib stubs (5) — placeholder registries never wired

| File | Reason |
|------|--------|
| `src/lib/auth.ts` | Deprecated custom auth stubs; app uses `AuthContext` + `authUtils` |
| `src/lib/cache/redisAdapter.ts` | Never imported; app uses in-memory `cache.ts` |
| `src/lib/plugins/registry.ts` | Plugin registry with zero consumers |
| `src/lib/themes/registry.ts` | Theme registry with zero consumers |
| `src/lib/design-system/tokens.ts` | Design tokens never imported |

### Unused barrel files (2)

| File | Reason |
|------|--------|
| `src/services/index.ts` | All consumers import `@/services/fooService` directly |
| `src/mappers/index.ts` | All consumers import mappers by file path |

---

## 2. Dead exports removed (refactor)

| Export | File | Reason |
|--------|------|--------|
| `flushMerchantAnalyticsCache` | `src/lib/cache.ts` | Alias of `flushOrderCache`; never imported |
| `invalidateStatisticsCache` | `src/services/statisticsService.ts` | Never called; use `fetchStatisticsData({ skipCache: true })` |
| `invalidateMerchantAnalyticsCache` | `src/services/statisticsService.ts` | Never called; order mutations use `flushOrderCache` |
| `mapDbOrder` re-export | `src/hooks/useOrderData.tsx` | Never imported from hook; import from `@/mappers/orderMapper` |
| `ProductRealtimePayload` export | `src/lib/merchantRealtimeHub.ts` | Made internal type; hub API unchanged |

---

## 3. Duplicate utilities — resolution

| Duplicate | Action |
|-----------|--------|
| `exportProducts.ts` vs `productExportUtils.ts` | **Removed** old file; kept `productExportUtils` |
| `statistics/StatCard.tsx` vs `ui/StatCard.tsx` | **Kept both** — different props/APIs; statistics uses growth %, dashboard uses clickable KPI cards |
| `FormSection` vs `ProductFormSection` | **Removed** old `FormSection` |
| Three order table components | **Removed** two legacy; kept `OrdersDataTable` |

---

## 4. npm dependencies removed

Removed packages with no remaining imports after UI primitive deletion:

```
cmdk
vaul
react-resizable-panels
input-otp
@radix-ui/react-context-menu
@radix-ui/react-aspect-ratio
@radix-ui/react-hover-card
@radix-ui/react-menubar
@radix-ui/react-navigation-menu
@radix-ui/react-radio-group
```

**27 total packages** removed including transitive deps.

### Dependencies kept (verified in use)

| Package | Used by |
|---------|---------|
| `@hello-pangea/dnd` | `ProductsList`, `ProductImagesManager` |
| `embla-carousel-react` | `ui/carousel` → storefront carousels |
| `framer-motion` | Landing pages, `ResetPassword` |
| `next-themes` | `ui/sonner` |
| `recharts` | `SalesChart`, statistics components |
| `lovable-tagger` | `vite.config.ts` (dev tooling) |

---

## 5. Intentionally not removed

| Item | Why kept |
|------|----------|
| `restoreLocalBackup` / `importLocalBackupFromFile` | Disaster-recovery API; exported for manual/ops use |
| `statistics/StatCard` + `ui/StatCard` | Both actively used with different interfaces |
| `OnboardingChecklist.tsx` | Already deleted in prior session (git status) |
| Empty dirs `lib/plugins/`, `lib/themes/`, `lib/design-system/` | Harmless; can be removed in a follow-up commit |
| All Supabase audit markdown in `supabase/` | Documentation, not runtime code |

---

## 6. Follow-up recommendations (optional)

1. **Unify StatCard** — merge `statistics/StatCard` props into `ui/StatCard` with optional `growth` prop (~1 component).
2. **Wire or remove DR restore UI** — expose `restoreLocalBackup` in `RecoveryBanner` or document CLI-only usage.
3. **ESLint unused-imports rule** — add `eslint-plugin-unused-imports` to catch regressions in CI.
4. **Update `ANALYTICS_SYSTEMS_AUDIT.md`** — replace `invalidateMerchantAnalyticsCache` reference with `flushOrderCache`.

---

## 7. Verification commands

```bash
npm run typecheck   # pass
npm test            # 132/132 pass
npm run build       # recommended before deploy
```

No production routes, realtime subscriptions, or checkout flows were modified beyond removing unreachable code.
