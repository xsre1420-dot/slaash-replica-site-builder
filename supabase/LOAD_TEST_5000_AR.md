# اختبار تحمل المنصة — 5,000 مستخدم متزامن

**التاريخ:** 2026-06-19  
**الدور:** Principal Enterprise SaaS Auditor  
**النطاق:** محاكاة 5,000 زائر متزامن على واجهة المتجر (Storefront)  
**البيئة المستهدفة:** Staging أو Production (مع حذر) — **لا تُنفَّذ على production بدون موافقة**

---

## 1. الهدف

قياس قدرة المنصة على تحمّل **5,000 مستخدم متزامن** يتصفحون متجراً واحداً أو عدة متاجر، وتحديد:

- معدل الأخطاء (Error Rate)
- زمن الاستجابة (P50 / P95 / P99)
- Throughput (طلبات/ثانية)
- نقطة الانهيار الفعلية مقابل التقدير المعماري (~2,500 حد إجهاد · ~1,500 مريح)

---

## 2. ما يُختبر وما لا يُختبر

| يُختبر ✅ | لا يُختبر ❌ |
|-----------|-------------|
| `get_storefront_page_bundle` — تحميل صفحة المتجر | `create_order_with_stock_deduction` — الطلبات |
| `track_store_visit_by_slug` — تتبع الزيارات | خصم المخزون |
| `get_store_meta` / `list_public_store_slugs` (وضع infra) | Realtime WebSocket للتجار |
| Edge function `get-store-products` (إن مُفعّل) | رفع الصور |

> **مهم:** اختبار التحمل الحالي **لا ينشئ طلبات حقيقية** حتى لا يُفسد المخزون أو البيانات.

---

## 3. المتطلبات قبل التشغيل

### 3.1 البنية التحتية

- [ ] تطبيق migrations حتى **v56** (`npm run db:deploy`)
- [ ] خطة **Supabase Pro** أو أعلى
- [ ] **Supavisor pooler** على المنفذ **6543** (موصى به فوق 500 مستخدم)
- [ ] نشر edge function: `npm run functions:deploy-storefront`
- [ ] متجر تجريبي منشور بمنتجات (`--slug=YOUR_SLUG`)

### 3.2 ملف البيئة (`.env`)

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_STOREFRONT_EDGE_ENABLED=true   # اختياري — لاختبار Edge
```

### 3.3 بذرة متجر تجريبي (اختياري)

```bash
npm run load:seed
```

---

## 4. سيناريو الاختبار — 5,000 مستخدم

### 4.1 السيناريو الأساسي (موصى به)

**محاكاة زائر حقيقي:** تحميل bundle المتجر + تتبع زيارة (2 RPC لكل جلسة).

```bash
npm run load:test -- --users=5000 --duration=60 --slug=YOUR_STORE_SLUG --mode=realistic
```

| المعامل | القيمة | الشرح |
|---------|--------|-------|
| `--users=5000` | 5,000 | عدد العمال المتزامنين (virtual users) |
| `--duration=60` | 60 ثانية | مدة كل مرحلة ramp |
| `--slug=` | slug المتجر | متجر منشور فعلياً |
| `--mode=realistic` | واقعي | bundle + visit (مثل الإنتاج) |

### 4.2 اختبار تدريجي (Ramp-up) — موصى به قبل القفزة إلى 5000

السكربت يرفع الحمل تلقائياً: 10 → 25 → 50 → 100 → 200 → 500 → 1000 → 2500 → **5000**

```bash
npm run load:test -- --users=5000 --duration=30 --slug=YOUR_STORE_SLUG
```

يتوقف تلقائياً عند تجاوز **10% أخطاء** أو **P95 > 8000ms**.

### 4.3 اختبار Edge + CDN

```bash
# تأكد من VITE_STOREFRONT_EDGE_ENABLED=true
npm run load:test -- --users=5000 --duration=45 --slug=YOUR_STORE_SLUG --mode=realistic
```

### 4.4 اختبار ضغط البنية (بدون متجر)

```bash
npm run load:test -- --users=5000 --duration=30 --mode=infra
```

---

## 5. معايير النجاح — 5,000 مستخدم

| المؤشر | ✅ ناجح | ⚠ متدهور | ❌ فاشل |
|--------|---------|----------|---------|
| **معدل الأخطاء** | < 2% | 2% – 10% | > 10% |
| **P95 latency** | < 3,000 ms | 3,000 – 8,000 ms | > 8,000 ms |
| **P50 latency** | < 500 ms | 500 – 1,500 ms | > 1,500 ms |
| **Throughput** | > 400 req/s | 200 – 400 req/s | < 200 req/s |
| **Timeouts (12s)** | 0 | < 1% | ≥ 1% |

### التوقعات المعمارية (بعد v41–v56)

| المستخدمون | التوقع | الملاحظة |
|------------|--------|----------|
| 500 | 0% أخطاء · ~600 req/s | ✅ مريح |
| 1,000 | < 1% أخطاء · ~700 req/s | ✅ مع pooler |
| 2,500 | 1–3% أخطاء | ⚠ حد الإجهاد المريح |
| **5,000** | **3–8% أخطاء · P95 مرتفع** | ⚠ **يتجاوز السعة الآمنة (~1,200)** بدون ترقية infra |
| 5,000 + Edge + CDN | 2–5% أخطاء | ⚠ أفضل — يقلل ضغط Origin |

> **الخلاصة:** 5,000 مستخدم **اختبار إجهاد (stress test)** وليس السعة التشغيلية الآمنة. السعة الآمنة الحالية: **~1,000–1,200** concurrent. الوصول لـ 5,000 مريح يتطلب: CDN أمام Storage، Edge v56، Read Replica، وترقية Realtime.

---

## 6. مراحل التنفيذ (Runbook)

### المرحلة 1 — التحضير (15 دقيقة)

1. نشر DB + Edge
2. التحقق: `npm run db:verify`
3. التحقق من slug: فتح `/store/YOUR_SLUG` في المتصفح
4. تفعيل مراقبة Supabase Dashboard (CPU, Connections, API)

### المرحلة 2 — Warm-up (5 دقائق)

```bash
npm run load:test -- --users=100 --duration=30 --slug=YOUR_STORE_SLUG
```

**النجاح:** Error < 1% · P95 < 500ms

### المرحلة 3 — Mid-load (10 دقائق)

```bash
npm run load:test -- --users=1000 --duration=45 --slug=YOUR_STORE_SLUG
```

**النجاح:** Error < 2% · P95 < 2000ms

### المرحلة 4 — Stress 5,000 (60 دقيقة)

```bash
npm run load:test -- --users=5000 --duration=60 --slug=YOUR_STORE_SLUG --mode=realistic
```

**سجّل:** req/s · err% · p50 · p95 · p99 · status breakdown

### المرحلة 5 — Cool-down + Health

```bash
npm run health:monitor
npm run db:analytics-test
```

---

## 7. ما تراقبه أثناء الاختبار

| المصدر | المؤشر | عتبة تحذير |
|--------|--------|------------|
| Supabase Dashboard | Postgres CPU | > 70% |
| Supabase Dashboard | Active connections | > 80% من الحد |
| Supabase Dashboard | API rate 429 | أي طلبات |
| Load script output | Error rate | > 2% |
| Load script output | P95 | > 3000ms |
| `platform_health_check` | RPC missing | أي فشل |

---

## 8. نموذج تقرير النتائج

```
═══════════════════════════════════════════════════
  تقرير اختبار التحمل — 5,000 مستخدم متزامن
═══════════════════════════════════════════════════
التاريخ:     ___________
البيئة:       Staging / Production
المتجر (slug): ___________
Migrations:   v56 ✅ / ❌
Edge CDN:     مُفعّل ✅ / ❌
Pooler:       6543 ✅ / ❌

────────────────── النتائج ──────────────────
المستخدمون    Req/s    Err%     P50      P95      P99
   500        ____     ____     ____     ____     ____
  1000        ____     ____     ____     ____     ____
  2500        ____     ____     ____     ____     ____
  5000        ____     ____     ____     ____     ____

────────────────── الحكم ──────────────────
□ ناجح  □ متدهور  □ فاشل

السعة المريحة الم observed:     ~____ concurrent
نقطة الانهيار:                  ~____ concurrent

────────────────── عنق الزجاجة ──────────────────
1. _________________________________
2. _________________________________
3. _________________________________

────────────────── التوصيات ──────────────────
1. _________________________________
2. _________________________________
═══════════════════════════════════════════════════
```

---

## 9. أوامر سريعة

```bash
# اختبار 5000 كامل (ramp تلقائي)
npm run load:test -- --users=5000 --duration=60 --slug=YOUR_SLUG

# اختبار 5000 مباشر (مرحلة واحدة — عدّل السكربت أو استخدم users=5000 فقط)
npm run load:test -- --users=5000 --duration=90 --slug=YOUR_SLUG --timeout=15000

# فحص الصحة بعد الاختبار
npm run health:monitor
npm run recovery:check
```

---

## 10. تحذيرات

1. **لا تشغّل على production** أثناء ساعات الذروة — يؤثر على تجار حقيقيين.
2. **مصدر IP واحد** — rate limit الزيارات (120/ساعة/IP) قد يُفعّل soft-limit؛ النتائج تمثل NAT واحد وليس 5000 IP حقيقي.
3. **Checkout غير مشمول** — نجاح هذا الاختبار لا يضمن تحمل 5000 عملية شراء متزامنة.
4. **Realtime التجار** — 5000 زائر ≠ 5000 تاجر؛ قنوات WS ≈ 2 × عدد التجار online فقط.
5. للنتائج **تمثيلية** — استخدم k6 أو Locust من عدة IPs في Staging.

---

## 11. المراجع

- [LOAD_TEST_BOTTLENECK_REPORT.md](./LOAD_TEST_BOTTLENECK_REPORT.md)
- [CAPACITY_PROJECTION_REPORT.md](./CAPACITY_PROJECTION_REPORT.md)
- [FINAL_PLATFORM_ASSESSMENT.md](./FINAL_PLATFORM_ASSESSMENT.md)
- السكربت: `scripts/load-test.mjs`
