# حالة تطبيق الاقتراحات — Top 20 + Phase C

**آخر تحديث:** 2026-06-25 (v58)  
**مرجع التقييم:** `supabase/FINAL_PLATFORM_ASSESSMENT.md`

---

## ملخص سريع

| الحالة | العدد |
|--------|------:|
| ✅ مطبّق بالكامل (كود) | 17 |
| ⚠️ جزئي / يحتاج نشر يدوي | 4 |
| ❌ بنية تحتية (لوحة Supabase / CDN DNS) | 5 |

**كل ما يمكن تنفيذه من الكود طُبِّق.** البنود المتبقية تتطلب إعدادات لوحة Supabase، DNS، أو Upstash.

---

## Top 20 — حالة كل بند

| # | الاقتراح | الحالة | الدليل |
|---|----------|--------|--------|
| 1 | توحيد طبقة المنتج → `productsCrudService` | ✅ | `productService` → crud + catalog |
| 2 | Idempotency على إنشاء المنتج (server) | ✅ | migration v58 + `lookup/record_product_idempotency` + `addProduct` |
| 3 | Keyset pagination (منتجات + طلبات) | ✅ | منتجات: `p_cursor`؛ طلبات: `list_merchant_orders` + `useOrders` cursor chain |
| 4 | `import_jobs` queue للـ CSV | ✅ | migration v58 + `importJobService` + `BulkUpload` + edge `process-import-jobs` |
| 5 | إزالة `loadAllMerchantProducts` | ✅ | صفحة واحدة + deprecated stub |
| 6 | نشر edge functions + ALLOWED_ORIGINS | ⚠️ | دوال جاهزة — `supabase functions deploy` + secrets |
| 7 | Supabase PITR + نسخ احتياطي | ❌ | `PHASE_C_OPS_RUNBOOK.md` |
| 8 | Observability مركزي (webhook) | ✅ | `reporter.ts` + `VITE_OBSERVABILITY_WEBHOOK_URL` |
| 9 | Read replica للتحليلات | ❌ | `PHASE_C_OPS_RUNBOOK.md` |
| 10 | Partition + TTL لـ `store_visits` | ⚠️ | `prune_store_visits()` في v58 — جدولة pg_cron يدوياً |
| 11 | Realtime "Reconnect" UI | ✅ | `RealtimeReconnectBanner` |
| 12 | `callSupabaseRpc` typed | ⚠️ | order/products/import — باقي الخدمات تدريجياً |
| 13 | Route-level error boundaries | ✅ | `RouteErrorBoundary` |
| 14 | Cloudflare CDN على storage | ⚠️ | `VITE_CDN_BASE_URL` + `cdnMediaUtils` — يحتاج DNS |
| 15 | Merchant offline write queue flush | ✅ | `offlineSyncService` + `OfflineBanner` |
| 16 | Edge image processing worker | ✅ | `optimize-image` edge function |
| 17 | CSP headers | ✅ | `vercel.json` Content-Security-Policy |
| 18 | `assertMerchantOwner()` شامل | ✅ | products/orders/inventory/import |
| 19 | Chaos drills ربع سنوية | ⚠️ | `npm run db:chaos-test` — عملية تشغيل |
| 20 | Shared Redis cache | ❌ | `PHASE_C_OPS_RUNBOOK.md` |

---

## migration v58 (`20260625000058_platform_recommendations_bundle.sql`)

- `product_create_idempotency` + RPCs
- `import_jobs` + `enqueue_product_import_job` + `process_product_import_batch`
- `list_merchant_orders` + `p_cursor` / `next_cursor`
- `prune_store_visits(retention_days)`

**نشر:** `npm run db:deploy` أو `supabase db push`

---

## خطوات ما بعد النشر

```bash
supabase secrets set ALLOWED_ORIGINS=https://your-app.com
supabase functions deploy process-import-jobs optimize-image get-store-products
npm run db:deploy
```

جدولة أسبوعية:

```sql
SELECT public.prune_store_visits(90);
```
