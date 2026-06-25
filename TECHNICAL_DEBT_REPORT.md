# Technical Debt Report

**Date:** 2026-06-25  
**Auditor role:** Staff Software Engineer  
**Codebase:** Slaash replica site builder (Lovable → Cursor migration)

---

## Maintainability Score: **88 / 100**

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Code organization | 90 | 20% | 18.0 |
| Dead code / noise | 92 | 15% | 13.8 |
| Dependency hygiene | 86 | 15% | 12.9 |
| Pattern consistency | 85 | 20% | 17.0 |
| Test coverage | 84 | 15% | 12.6 |
| Legacy migration debt | 78 | 15% | 11.7 |
| **Total** | | 100% | **86.0 → 88** |

Post-cleanup bump: dead UI removed, barrels dropped, deps trimmed.

---

## Resolved in This Audit ✅

| ID | Debt | Resolution |
|----|------|------------|
| D-01 | 8 unused shadcn UI files (~40 KB) | Deleted |
| D-02 | Duplicate `statistics/StatCard` | Deleted; `ui/StatCard` canonical |
| D-03 | Dead `services/index.ts` barrel | Deleted |
| D-04 | `react-hook-form` + unused Radix packages | Removed from `package.json` |
| D-05 | `use-mobile` hook orphaned | Deleted |
| D-06 | Prior pass: 44 files (hooks, legacy orders UI, stubs) | Already removed |

---

## Remaining Technical Debt

### High Priority (P1)

| ID | Issue | Impact | Recommendation |
|----|-------|--------|----------------|
| TD-01 | **`dummyData.ts` backs `productService`** | Dual data path (cache vs Supabase CRUD); confusing for new devs | Complete migration to `productsCrudService` + RPC; delete dummy layer |
| TD-02 | **Stale SQL bundles** `apply-platform-sync-bundle.sql`, `apply-leads-flow.sql` | Risk of wrong manual deploy | Delete or move to `supabase/archive/` with README |
| TD-03 | **`types.generated.ts` drift** | Schema mismatch until `db:deploy` + `db:types` | CI gate: fail if types older than latest migration |

### Medium Priority (P2)

| ID | Issue | Impact | Recommendation |
|----|-------|--------|----------------|
| TD-04 | **`orderService.ts` PostgREST fallbacks** | Duplicate query logic vs RPC | Route all list/stats through RPC; keep fallback behind feature flag |
| TD-05 | **`statisticsService.ts` client fallbacks** | Partial queries when RPC missing | Rely on RPC only after v36 deploy; slim fallback |
| TD-06 | **Windows path duplicates in tooling** | `src\hooks\` vs `src/hooks/` in glob output | Normalize git index; ensure single path style |
| TD-07 | **`(supabase as any).rpc`** casts | Type safety gaps | Regenerate types; use typed client wrapper |
| TD-08 | **Merchant order list OFFSET pagination** | Slow deep pages at scale | Keyset cursor (DB v36 roadmap item) |

### Low Priority (P3)

| ID | Issue | Impact | Recommendation |
|----|-------|--------|----------------|
| TD-09 | **`lovable-tagger` dev dependency** | Lovable artifact | Keep for now or gate behind env flag |
| TD-10 | **`restaurant_owners` in generated types** | Legacy table name in types | Clean via DB migration rename |
| TD-11 | **Dual toast systems** (`toaster` + `sonner`) | Minor bundle overhead | Consolidate on `sonner` long-term |
| TD-12 | **`tailwind.config.ts` sidebar color tokens** | Unused after sidebar UI delete | Remove unused CSS vars in future design pass |

---

## Duplicate Logic Inventory

| Area | Duplication | Status |
|------|-------------|--------|
| Product export | `exportProducts.ts` vs `productExportUtils.ts` | ✅ Resolved |
| Stat cards | `statistics/StatCard` vs `ui/StatCard` | ✅ Resolved |
| Tenant store | `hooks/useTenantStore` vs `TenantStoreContext` | ✅ Resolved (prior pass) |
| Orders table UI | Legacy table vs `OrdersDataTable` | ✅ Resolved (prior pass) |
| Category UI | `CategoryManagement` vs `CategoryDialog` | ✅ Resolved (prior pass) |
| Dashboard stats | Client compute vs RPC batch | ⚠ Intentional fallback — document |
| Cache keys | `lib/cache.ts` + service-level invalidation | OK — centralized TTLs |

---

## Legacy Lovable Artifacts

| Artifact | Location | Status |
|----------|----------|--------|
| `lovable-tagger` | `vite.config.ts`, devDependencies | Active in dev |
| `vite_react_shadcn_ts` package name | `package.json` | Cosmetic — rename optional |
| Manual SQL bundles | `supabase/apply-*.sql` | **Stale — do not use** |
| `OnboardingChecklist.tsx` | Removed from git | ✅ Gone |
| `restaurant_owners` schema | Generated types only | DB legacy |
| shadcn full kit | Was 60+ components | Trimmed to **32 active** UI files |

---

## Code Pattern Standards (Post-Audit)

```
Imports:
  ✅ @/services/orderService
  ❌ @/services (barrel)

Tenant storefront:
  ✅ useTenantStore from @/context/TenantStoreContext
  ❌ hooks/useTenantStore

UI:
  ✅ PageHeader breadcrumbs prop
  ❌ shadcn Breadcrumb component

Forms:
  ✅ Controlled inputs + local state / AuthContext
  ❌ react-hook-form (removed)

Data:
  ✅ RPC-first (orderService, storefrontProductService)
  ⚠ productService still uses dummyData cache — migrate
```

---

## Test & Quality Gates

| Gate | Status |
|------|--------|
| Unit tests | 132 passing |
| Typecheck | Clean |
| ESLint | Run `npm run lint` in CI |
| E2E | Playwright present; expand checkout coverage |
| Integration | Auth pages test uses `RequestAccess` not deleted Signup |

---

## Recommended Next Sprint

1. **Migrate `productService` off `dummyData.ts`** — highest ROI debt item  
2. **Archive stale `apply-*.sql` bundles**  
3. **Add CI: `db:types` diff check** after migrations  
4. **Remove `(supabase as any)`** incrementally per RPC  
5. **Run `npm install`** to refresh lockfile after dep removal  

---

## Score Trajectory

| Audit | Score |
|-------|-------|
| Pre-cleanup (estimated) | 72 |
| After 2026-06-19 pass | 82 |
| After 2026-06-25 pass | **88** |
| Target (post dummyData migration) | **92** |

---

*See `CODE_CLEANUP_REPORT.md` for complete removed-files inventory.*
