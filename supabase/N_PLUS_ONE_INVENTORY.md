# N+1 Pattern Inventory — Phase 2

Generated: 2026-06-25T21:21:40.873Z

| Metric | Value |
|--------|-------|
| Files scanned | 375 |
| Open findings | 9 |
| Mitigated | 0 |

- **high** `src/utils/checkoutValidation.ts:81` — for-loop await DB
- **high** `src/services/productsCrudService.ts:72` — for-loop await DB
- **high** `src/services/productsCrudService.ts:175` — for-loop await DB
- **high** `src/services/productsCrudService.ts:252` — for-loop await DB
- **high** `src/services/platformHealthService.ts:127` — for-loop await DB
- **high** `src/services/platformHealthService.ts:148` — for-loop await DB
- **high** `src/services/orderService.ts:624` — for-loop await DB
- **high** `src/services/merchantProductCatalogService.ts:384` — for-loop await DB
- **high** `supabase/functions/process-order-webhook-outbox/index.ts:75` — for-loop await DB
