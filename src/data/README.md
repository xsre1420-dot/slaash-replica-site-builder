# Static data only

Place **non-database** configuration here:

- `subscriptionPlans.ts` — public pricing tiers
- `leadFormOptions.ts` — lead form enums

**Do not add** runtime data layers here. Merchant catalog CRUD lives in `@/services/productService` (backed by `dummyData.ts` pending full migration to `merchantProductCatalog`).
