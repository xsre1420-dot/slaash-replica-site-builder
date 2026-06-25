# Queue Architecture Report

**Audit date:** 2026-06-19 (updated v55)  
**Role:** Distributed Systems Architecture Review  
**Scope:** Product publishing, image processing, analytics, notifications, inventory sync, bulk operations  
**Status:** Webhook outbox consumer shipped v55 — see [BACKGROUND_PROCESSING_AUDIT_REPORT.md](./BACKGROUND_PROCESSING_AUDIT_REPORT.md)

---

## Executive Summary

| Dimension | Score | Assessment |
|-----------|-------|------------|
| **Synchronous correctness** | 88/100 | Checkout, stock deduction, and publish RPCs correctly stay inline |
| **Async coverage** | 52/100 | Outbox table exists but has **no consumer**; several UI-blocking heavy paths remain |
| **Retry / recovery** | 61/100 | Order RPC retries present; webhook/Meta/bulk paths lack durable retry |
| **Job observability** | 48/100 | Client `healthMonitor` only; no server-side job dashboard |
| **Scale readiness (1k→10k merchants)** | 58/100 | DB rollups help analytics; bulk import + full-catalog reload will bottleneck |

**Verdict:** The platform has good **database-level async** (triggers, rollups, outbox enqueue) but weak **worker-tier async**. The highest-impact gap is completing the outbox pattern and moving UI-blocking catalog/image work off the request path.

---

## Phase 1 — Discovery

### 1. Product publishing

| Step | Location | Sync / Async | Notes |
|------|----------|--------------|-------|
| Validate + insert draft | `dummyData.addProduct` | **Sync** | Multi-column fallback inserts; blocks save button |
| Publish toggle | `publish_owner_product` RPC | **Sync** | Single `UPDATE` — fast (~20–80ms), correct |
| Cache + storefront invalidation | `syncMerchantProductCatalog` | **Async** (`void invalidateStorefrontForOwner`) | Non-blocking |
| Post-save catalog reload | `loadAllMerchantProducts(true)` | **Sync — BLOCKS** | Paginates up to **100 pages** sequentially |
| Bulk publish | N/A | — | No batch publish job; N sequential RPCs if user bulk-publishes |

```605:626:src/data/dummyData.ts
export const publishProduct = async (productId: string) => {
  // ...
  const { data, error } = await (supabase as any).rpc('publish_owner_product', {
    p_product_id: productId,
  });
  if (!error && data?.success && data?.product) {
    syncProductCachesAfterMutation(user.id, data.product as Record<string, unknown>);
    // ...
  }
```

**Finding:** Publish itself is lightweight. The **post-mutation full catalog reload** is the real blocker for merchants with large catalogs.

---

### 2. Image processing

| Step | Location | Sync / Async | Notes |
|------|----------|--------------|-------|
| MIME normalize | `imageUpload.normalizeImageFile` | Sync | Fast |
| Canvas resize/compress | `compressImage` (main thread) | **Sync — BLOCKS UI** | Up to 1200×1200 WebP/JPEG |
| Storage upload (main) | `supabase.storage.upload` | Sync (awaits network) | Blocks upload spinner |
| Thumbnail generation + upload | `generateThumbnail` | Sync after main upload | Adds 200–800ms per image |
| Duplicate compressor | `ProductImagesManager` | Sync | Second canvas path — maintenance debt |

```148:196:src/utils/imageUpload.ts
export const uploadImage = async (file: File, userId: string): Promise<string> => {
  // ...
  processedFile = await compressImage(normalized, MAX_WIDTH, MAX_HEIGHT, QUALITY);
  // ... upload main ...
  const thumbnail = await generateThumbnail(normalized);
  await supabase.storage.from(BUCKET).upload(thumbName, thumbnail, { ... });
```

**Finding:** All image CPU work runs on the **browser main thread**. Multi-image uploads block interaction. Thumbnail failure is non-critical (logged) — good pattern to extend.

---

### 3. Analytics calculations

| Layer | Location | Sync / Async | Notes |
|-------|----------|--------------|-------|
| Daily rollups | DB triggers → `store_daily_stats` | **Async (DB)** | Incremental on order/visit writes |
| KPI RPC | `get_store_statistics`, `get_statistics_page_bundle` | Sync read | Pre-aggregated when rollups exist |
| Chart data fetch | `statisticsService` | **Sync — heavy fallback** | Up to **5,000 orders + 5,000 visits** per period |
| Client aggregation | `statisticsCalculator` | **Sync CPU** | Runs on main thread after fetch |
| Dashboard batch | `get_dashboard_statistics_batch` | Sync read | Cached 90s — good |

**Finding:** Analytics is **hybrid**. Historical periods use rollups (good). Custom ranges / RPC-missing DBs still pull thousands of rows into the browser — unacceptable at scale.

---

### 4. Notification delivery

| Channel | Location | Sync / Async | Notes |
|---------|----------|--------------|-------|
| In-app order alerts | `useOrderNotifications` + realtime | **Client-only** | localStorage persistence; no server queue |
| Meta Purchase pixel | `orderService` → `meta-conversions` edge | **Async** (`void invoke`) | Fire-and-forget; no retry queue |
| Order webhook outbox | `enqueue_order_webhook_event` trigger | **Enqueue only** | **No worker consumes `order_webhook_outbox`** |
| WhatsApp | `WhatsAppTab` / deep links | Manual | No automated message dispatch |
| Toast / sonner | UI | Sync | Ephemeral |

```635:653:src/services/orderService.ts
void (supabase as any).functions
  .invoke('meta-conversions', { body: { ... } })
  .catch((err: unknown) => { logger.warn('meta-conversions.invoke.failed', ...); });
```

**Finding:** The **outbox table is production-ready schema** (`pending` / `processing` / `delivered` / `failed`, `attempts`, `last_error`) but **delivery is never processed**. This is the largest async architecture gap.

---

### 5. Inventory synchronization

| Operation | Location | Sync / Async | Notes |
|-----------|----------|--------------|-------|
| Checkout stock deduct | `create_order_with_stock_deduction` RPC | **Sync (required)** | `FOR UPDATE` locks — correct |
| Manual restock | `increment_product_stock` RPC | Sync | Single product; acceptable |
| Movement audit log | `inventory_movements` insert | Sync (often inline) | Bulk import inserts movements in same request |
| Realtime cache patch | `merchantRealtimeHub` | Event-driven | Patches cache; selective storefront invalidation |
| Stock reconciliation | — | **Missing** | No job compares `products.stock_quantity` vs movement ledger |
| Cross-channel sync | — | N/A | Single DB source of truth |

**Finding:** **Write path is correctly synchronous** for commerce integrity. **Read/reconcile path** lacks a background verifier for drift after partial failures.

---

### Additional discovery: Merchant hydration & bulk import

| Operation | Location | Impact |
|-----------|----------|--------|
| Login hydration | `hydrateMerchantStore` | Parallel: settings + **page 0 products** + categories + orders — good |
| Full catalog load | `loadAllMerchantProducts` | **Sequential pagination** — used after add/edit product, footer manager |
| CSV bulk import | `bulkImportProducts` | Chunks of 20, **blocks dialog** until all chunks complete |
| Offline queue | `useOfflineQueue` | **Defined but unused** in app — no integration |

```289:320:src/data/dummyData.ts
export const loadAllMerchantProducts = async (force = false): Promise<ProductsPageResult> => {
  // ...
  while (hasMore && page < 100) {
    const result = await loadProductsPage(page, pageSize, force);
    // ...
    page += 1;
  }
```

---

## Phase 2 — Bottleneck Detection

### Critical (blocks user actions)

| Bottleneck | User action blocked | Est. latency @ scale | Severity |
|------------|---------------------|----------------------|----------|
| `loadAllMerchantProducts` after save | Add/edit product navigation | 2–30s @ 500+ products | **P0** |
| Image canvas compress + upload | Save product, multi-image upload | 1–5s per image | **P0** |
| Bulk CSV import in modal | Bulk upload dialog | 5–120s @ 200+ rows | **P0** |
| Statistics fallback fetch | Open Statistics page | 3–15s @ 5k orders | **P1** |
| Login hydration (cold) | First dashboard paint | 0.5–2s | **P2** (acceptable) |

### Must remain synchronous (do not queue)

| Operation | Reason |
|-----------|--------|
| `create_order_with_stock_deduction` | Atomic inventory + payment integrity |
| `publish_owner_product` (single row) | User expects immediate visibility confirmation |
| Checkout validation RPC | Price/stock must be current at submit time |
| Auth session establishment | Security |

### Latent (async schema exists, no worker)

| Component | Risk |
|-----------|------|
| `order_webhook_outbox` | Merchants expect integrations; events pile up undelivered |
| Meta conversion `void invoke` | Attribution loss on transient failures |
| `useOfflineQueue` | Dead code — missed offline resilience |

---

## Phase 3 — Async Architecture Recommendations

### Target architecture

```
┌─────────────┐     write      ┌──────────────────┐     trigger      ┌─────────────┐
│  Browser    │ ─────────────► │   PostgreSQL     │ ───────────────► │   Outbox /  │
│  (merchant) │                │  (source of      │                  │  job_queue  │
└─────────────┘                │   truth)         │                  └──────┬──────┘
       │                       └──────────────────┘                         │
       │ presigned upload                                                    │ poll / NOTIFY
       ▼                                                                     ▼
┌─────────────┐                                                       ┌─────────────┐
│   Storage   │ ◄── image-worker (Edge)                               │   Workers   │
│   (images)  │     resize + thumb                                    │  (Edge/cron)│
└─────────────┘                                                       └──────┬──────┘
                                                                             │
                    ┌────────────────────────────────────────────────────────┤
                    ▼                        ▼                               ▼
             Webhook HTTPS            Meta / email / WhatsApp          Rollup refresh
             merchant endpoints       notification providers           reconcile jobs
```

### Queue technology choice (Supabase-native)

| Option | Fit | Recommendation |
|--------|-----|----------------|
| **`order_webhook_outbox` + Edge cron** | Already migrated | **P0 — extend for all async work** |
| **pgmq** (Supabase extension) | Durable FIFO | P1 if outbox pattern grows past webhooks |
| **pg_cron** | Scheduled reconciliation | P1 for inventory + analytics refresh |
| **Client `useOfflineQueue`** | Offline merchant edits | P2 — wire to product save retry |
| **External (SQS/Redis)** | Multi-region | P3 — only if leaving Supabase compute |

### Per-domain recommendations

#### Analytics aggregation → **background (partially done)**

| Current | Target |
|---------|--------|
| DB triggers maintain `store_daily_stats` | Keep — already async at write time |
| Client fetches 5k rows for charts | **RPC-only chart endpoints**; never ship raw orders to browser |
| Custom date ranges | **On-demand rollup job** → write to `store_analytics_snapshots` → poll status |

**Job:** `refresh_owner_analytics_snapshot(owner_id, range)` — scheduled + on-demand.

#### Notification generation → **background (required)**

| Current | Target |
|---------|--------|
| Outbox enqueue on order INSERT | **Edge worker `process-webhook-outbox`** every 30s |
| Meta `void invoke` | Move to outbox row `event_type: meta.conversion` |
| In-app notifications | Keep realtime; optional push via same worker |

**Worker pseudoflow:**
1. `SELECT … FROM order_webhook_outbox WHERE status = 'pending' ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED`
2. Mark `processing`, POST to merchant webhook URL
3. On success → `delivered`; on failure → increment `attempts`, exponential backoff, `failed` after 5 attempts

#### Inventory reconciliation → **scheduled background**

| Current | Target |
|---------|--------|
| Movements written inline | Keep for audit |
| No drift detection | **Nightly cron:** `reconcile_inventory(owner_id)` |

**SQL check:** `products.stock_quantity` vs `SUM(inventory_movements.quantity_delta)` per product. Mismatches → `inventory_reconciliation_alerts` table + merchant notification.

#### Bulk imports → **job queue (required)**

| Current | Target |
|---------|--------|
| `bulkImportProducts` in browser loop | **Insert `import_jobs` row** → return `job_id` immediately |
| UI blocks until done | Poll `import_jobs.status` or subscribe via realtime |

**Job stages:** `queued` → `processing` → `completed` | `failed` (with row-level error report).

#### Image processing → **background worker**

| Current | Target |
|---------|--------|
| Main-thread canvas | **Presigned raw upload** → `image_processing_jobs` → Edge worker resizes |
| Save blocked on upload | Save product with `image_status: processing`; UI shows placeholder |

**Short-term (no infra):** Web Worker for `compressImage` — removes UI jank without new services.

---

## Phase 4 — Reliability

### Current state

| Capability | Status | Location |
|------------|--------|----------|
| Order idempotency | ✅ | `p_idempotency_key` in `create_order_with_stock_deduction` |
| Order RPC retry | ✅ | 3 attempts, backoff `400ms * attempt` — `orderService` |
| Outbox retry fields | ✅ Schema | `attempts`, `last_error`, `status` |
| Outbox consumer | ❌ Missing | — |
| Meta conversion retry | ❌ Log only | `.catch()` on invoke |
| Bulk import partial failure | ⚠️ Per-chunk errors returned | No resume |
| Job monitoring | ⚠️ Client-only | `healthMonitor.ts` — 15min sliding window |
| Dead letter queue | ⚠️ `failed` status unused | — |
| Offline queue | ❌ Unused | `useOfflineQueue.tsx` |

### Required reliability patterns

```
┌────────────────────────────────────────────────────────────┐
│  AT-LEAST-ONCE delivery + IDEMPOTENT consumers             │
│  ────────────────────────────────────────────────────────  │
│  • Webhook: HMAC signature + merchant returns 2xx          │
│  • Meta: event_id = order_id (already deduped in edge)     │
│  • Bulk import: chunk idempotency key per CSV row hash       │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  RETRY policy (recommended)                                │
│  ────────────────────────────────────────────────────────  │
│  attempts: 5                                               │
│  backoff: min(30s, 2^attempt * 1s) + jitter               │
│  DLQ: status = 'failed' after max attempts                   │
│  manual replay: admin RPC reset status → pending             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  JOB MONITORING                                            │
│  ────────────────────────────────────────────────────────  │
│  • Extend platform_health_check with outbox_pending_count  │
│  • Admin /admin/health panel: job lag, failure rate        │
│  • Alert when pending > 100 or oldest > 5min               │
└────────────────────────────────────────────────────────────┘
```

### Failure recovery scenarios

| Scenario | Recovery |
|----------|----------|
| Webhook endpoint down | Outbox retries → `failed`; merchant dashboard shows failed deliveries |
| Bulk import chunk fails | Job marks partial success; user downloads error CSV |
| Image worker fails | Product shows processing badge; retry job or merchant re-upload |
| Analytics snapshot stale | Serve cached snapshot + `stale: true` badge; background refresh |
| Stock drift detected | Reconciliation job creates alert; manual restock workflow |

---

## Phase 5 — Deliverables

### A. Queue Architecture Report (this document)

**Maturity model:**

| Level | Description | Current |
|-------|-------------|---------|
| L0 | All sync | — |
| L1 | Fire-and-forget | Meta invoke, cache invalidation |
| L2 | Outbox enqueue | `order_webhook_outbox` ✅ |
| L3 | Workers + retry | **Not implemented** |
| L4 | Full observability + DLQ replay | **Not implemented** |

**Platform is at L2** — enqueue without consume.

---

### B. Async Processing Roadmap

#### Phase A — Quick wins (1–2 weeks, no new tables)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| A1 | Replace `loadAllMerchantProducts` post-save with **single product cache patch** + paginated reload | High | Low |
| A2 | Move `compressImage` to **Web Worker** | Medium | Low |
| A3 | Bulk import: yield progress via **chunked `requestIdleCallback`** + cancel token | Medium | Low |
| A4 | Statistics: hard-disable 5k row fallback when RPC exists; show degraded UI instead | Medium | Low |

#### Phase B — Worker tier (2–4 weeks)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| B1 | Edge function **`process-order-webhook-outbox`** + pg_cron every 30s | **Critical** | Medium |
| B2 | Move Meta conversions into outbox (`event_type: meta.purchase`) | High | Medium |
| B3 | `import_jobs` table + **`process-bulk-import`** worker | High | Medium |
| B4 | Admin job status on `/admin/health` | Medium | Low |

#### Phase C — Scale tier (1–2 months)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| C1 | Presigned upload + **`process-product-image`** edge worker | High | High |
| C2 | `inventory_reconciliation` pg_cron (nightly) | Medium | Medium |
| C3 | `store_analytics_snapshots` for custom ranges | High | High |
| C4 | Wire `useOfflineQueue` to product save + restock | Medium | Medium |
| C5 | Optional: pgmq for cross-tenant fair scheduling | Medium | High |

---

### C. Scalability Impact Assessment

Assumptions: 1,000 active merchants, avg 200 products, 50 orders/day each, 10% use bulk import monthly.

| Workload | Today (sync / client) | After Phase B | After Phase C |
|----------|----------------------|---------------|---------------|
| Post-save catalog reload | **~2.4M product-row reads/day** (unnecessary full scans) | **~50k** (patch only) | Same |
| Bulk import (200 rows) | Blocks browser **30–90s**; ties UI thread | **<2s** ack + background | Same + image jobs |
| Statistics page open | **5k row fetch** worst case | RPC-only **<200ms** | Snapshot **<50ms** |
| Webhook delivery | **0% delivered** (no worker) | **>99%** within 60s | Same + DLQ replay |
| Image upload (5 images) | **5–25s** main-thread | **3–15s** (Web Worker) | **1–3s** ack (async process) |
| DB connection pressure | Spiky (bulk + stats) | Smoothed via workers | Predictable |

#### Estimated infrastructure load reduction

| Metric | Reduction after Phase B+C |
|--------|---------------------------|
| Merchant API read volume | **40–55%** |
| P95 merchant save latency | **70–85%** |
| Statistics page DB load | **80–90%** |
| Browser main-thread long tasks | **60%** (images) → **90%** (with worker upload) |

#### Scale limits

| Scale | Blocker without async | Safe after roadmap |
|-------|----------------------|-------------------|
| 100 merchants | Minor | ✅ |
| 1,000 merchants | Bulk import + stats fallback | ✅ Phase B |
| 10,000 merchants | Image processing + webhook backlog | ✅ Phase C + pgmq |
| 100k storefront visitors/day | Already mitigated (cache audit) | ✅ |

---

## Priority Matrix

```
                    IMPACT
                 High │  B1 Webhook worker     C1 Image worker
                      │  B3 Bulk import jobs   A1 Stop full catalog reload
                      │  B2 Meta → outbox      C2 Inventory reconcile
                 Low  │  A2 Web Worker compress A4 Stats fallback guard
                      └──────────────────────────────────────────►
                              Low              EFFORT           High
```

---

## Files referenced

| Area | Primary files |
|------|---------------|
| Publishing | `src/data/dummyData.ts`, `supabase/migrations/20260616000008_publish_and_reviews_fix.sql` |
| Images | `src/utils/imageUpload.ts`, `src/components/ProductImagesManager.tsx` |
| Analytics | `src/services/statisticsService.ts`, `supabase/migrations/20260625000004_recommended_improvements.sql` |
| Notifications | `src/hooks/useOrderNotifications.tsx`, `supabase/migrations/20260625000005_final_improvements.sql` |
| Inventory | `src/services/inventoryService.ts`, `create_order_with_stock_deduction` RPC |
| Bulk import | `src/services/productsCrudService.ts`, `src/components/product-management/BulkUpload.tsx` |
| Hydration | `src/services/merchantHydration.ts`, `src/context/StoreBootstrapContext.tsx` |
| Reliability | `src/services/orderService.ts`, `src/lib/observability/healthMonitor.ts` |
| Unused async | `src/hooks/useOfflineQueue.tsx` |

---

## Audit score: 58/100 (async maturity)

**Strengths:** Atomic checkout, DB rollup triggers, outbox schema, fire-and-forget Meta, realtime cache patching.  
**Gaps:** No outbox consumer, full-catalog reload anti-pattern, client-side analytics fallback, main-thread image processing, unused offline queue.

**Next recommended action:** Implement **B1** (`process-order-webhook-outbox` edge worker) and **A1** (replace `loadAllMerchantProducts` after single-product save) — highest ROI pair.
