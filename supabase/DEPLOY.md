# Supabase deployment (required for production)

The app code assumes migrations through `20260616000007` are applied.

## Quick deploy (linked project)

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
npm run db:deploy
```

Or manually:

```powershell
supabase db push
npm run db:types
```

## Critical migrations (June 2026)

| File | Fixes |
|------|--------|
| `20260616000001_checkout_stock_validation_fix.sql` | Checkout stock + tenant owner resolution |
| `20260616000002_order_realtime_and_variants.sql` | Realtime orders + variant deduction |
| `20260616000003_merchant_catalog_sync.sql` | Product lifecycle + merchant RPC |
| `20260616000004_products_schema_repair.sql` | Missing product columns |
| `20260616000005_platform_schema_contract.sql` | Storefront archived filter + schema contract |
| `20260616000006_post_audit_hardening.sql` | GRANTs + product view filters |
| `20260616000007_checkout_stock_unified.sql` | **Checkout stock fix** (variant vs aggregate) |

If checkout fails with "بعض المنتجات غير متوفرة" while products look in stock, apply **`20260616000007`** (or run all migrations in order).

## Without CLI

Open **Supabase Dashboard → SQL Editor** and run each file above in order.

## Verify after deploy

1. Create published product → appears in PM, Inventory, Storefront
2. Guest checkout on `/store/{slug}` → order succeeds
3. Order appears in merchant Orders within seconds (realtime)
