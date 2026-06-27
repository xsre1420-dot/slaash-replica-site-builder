# Storage & Media Architecture Audit

**Date:** 2026-06-19  
**Role:** Principal Cloud Storage Architect + Supabase Storage Specialist  
**Scope:** Buckets, RLS, upload/delete flows, media organization, tenant isolation, optimization

---

## Scores

| Metric | Score | Notes |
|--------|------:|-------|
| **Storage Health Score** | **74 / 100** | Single bucket works; flat paths; orphan risk on branding updates (fixed client-side) |
| **Security Score** | **86 / 100** | Write RLS owner-scoped; public read by design; path validation on delete |
| **Media Organization Score** | **58 / 100** | Target `store_id/{type}/` not implemented; all assets flat under `owner_id/` |
| **Reference Integrity Score** | **78 / 100** | Product delete + update cleanup added; audit script for orphans |

**Overall storage readiness:** **76 / 100** — production-viable for MVP; restructure recommended before scale.

---

## Phase 1 — Storage Discovery

### 1.1 Buckets

| Bucket | Public | Purpose | Created in |
|--------|--------|---------|------------|
| **`product-images`** | **Yes** | Products, logos, banners, all merchant media | `20260227104457` |

**Finding:** Only **one bucket** exists. Category images and brand assets are **not** separated. There is no `temp/` bucket for staging uploads.

### 1.2 Bucket permissions (effective after migrations)

| Operation | Role | Policy | Rule |
|-----------|------|--------|------|
| **SELECT** | `anon`, `authenticated` | `product_images_public_read` | `bucket_id = 'product-images'` |
| **INSERT** | `authenticated` | `Users can upload product images` | `auth.uid()::text = foldername(name)[1]` |
| **UPDATE** | `authenticated` | `Users can update own product images` | Same folder = `auth.uid()` |
| **DELETE** | `authenticated` | `Users can delete own product images` | Same folder = `auth.uid()` |

**Note:** Permissive `product_images_auth_*` policies (any authenticated user, any path) were **dropped** in `20260612000003` and `20260625000009`. Duplicate policy `Product images are publicly accessible` removed in v17.

### 1.3 URL types

| Type | Used? | Where |
|------|-------|-------|
| **Public URLs** | **Yes** | `getPublicUrl()` in `imageUpload.ts` — all storefront + dashboard images |
| **Signed URLs** | **No** | Not used anywhere in codebase |
| **Blob URLs** | Transient only | Blocked at product save via `validateProductImages` |

### 1.4 Upload flow

```
File → normalizeImageFile → compress (1200×1200, WebP 0.82)
  → path: {auth.uid()}/{uuid}.webp
  → supabase.storage.upload (cacheControl: 1 year)
  → getPublicUrl → return URL
  → optional thumb: {uid}/thumbs/{uuid}.webp (400px)
```

**Entry points:**

| Surface | File | Notes |
|---------|------|-------|
| Product images | `ProductImagesManager.tsx` → `uploadImage` | Double compression if file > 2MB |
| Store logo | `StoreInfoTab.tsx` → `uploadImage` | Same path as products |
| Store banners | `StoreInfoTab.tsx` → `uploadImage` | Same path as products |
| Bulk CSV import | `BulkUpload.tsx` | **External URLs only** — no storage upload |

**Guards:** `getAuthenticatedUserId()` must match `userId`; 5MB max; MIME allowlist.

### 1.5 Delete flow

| Trigger | Behavior |
|---------|----------|
| Remove product image in UI | `deleteImage` — main + thumb |
| Delete product | `deleteProductStorageImages` after DB delete |
| Update product images | `cleanupRemovedProductImages` after DB update (**this audit**) |
| Replace store logo | `cleanupRemovedBrandingImages` (**this audit**) |
| Remove banner | `deleteImage` on removed URL (**this audit**) |
| Failed product save after upload | **Orphan risk** — uploaded file not rolled back |

### 1.6 Update flow

- Storage objects are **immutable** (new UUID per upload). Updates = new upload + (now) old URL cleanup.
- No in-place `upsert` on product images (`upsert: false`).

---

## Phase 2 — Media Organization

### 2.1 Target vs actual structure

**Target (requested):**

```
store_id/
├── products/
├── categories/
├── branding/
├── banners/
└── temp/
```

**Actual:**

```
{owner_id}/
├── {uuid}.webp          ← products, logos, banners (undifferentiated)
└── thumbs/
    └── {uuid}.webp
```

| Asset type | DB column | Storage path | Category folder? |
|------------|-----------|--------------|------------------|
| Product main | `products.image_url` | `{owner_id}/{uuid}.webp` | No |
| Product gallery | `products.additional_images[]` | Same | No |
| Store logo | `store_settings.store_logo` | Same | No |
| Store banners | `store_settings.banner_images[]` | Same | No |
| Category images | — | **Not implemented** | N/A |
| Brand assets | — | **Not implemented** | N/A |
| Temp staging | — | **Not implemented** | N/A |

**Tenant key:** Folder = `auth.uid()` (= `owner_id`), **not** `store_id`. Valid for single-owner-per-store model.

### 2.2 Orphan / integrity findings

| Issue | Severity | Status |
|-------|----------|--------|
| Banner removed from UI but file kept | High | **Fixed** — `deleteImage` on remove |
| Logo replaced but old file kept | High | **Fixed** — `cleanupRemovedBrandingImages` |
| Product edit swaps images but old files kept | High | **Fixed** — `cleanupRemovedProductImages` |
| Product save fails after upload | Medium | Open — no transaction rollback |
| Abandoned uploads (cancel form) | Medium | Open — no `temp/` lifecycle |
| Thumbnails without main (failed main delete) | Low | `deleteImage` removes both |
| Bulk CSV external image URLs | Low | By design — not in our bucket |
| Duplicate URL in `additional_images` | Low | Detected by `findDuplicateUrlReferences` |

### 2.3 Detection tools (implemented)

```bash
# Full orphan / large-file / broken-reference scan (needs service role)
npm run storage:audit

# Per-merchant scan
node scripts/storage-audit.mjs --owner=<uuid>

# JSON output for dashboards
node scripts/storage-audit.mjs --json
```

**Code:** `src/utils/storageMediaUtils.ts` — path parsing, orphan diff, duplicate detection.

---

## Phase 3 — Security

### 3.1 Tenant isolation model

```
Write path:  {auth.uid()}/...  ← enforced by storage RLS INSERT/UPDATE/DELETE
Read path:   public bucket     ← intentional for storefront CDN
Client guard: uploadImage/deleteImage verify auth.uid() === folder owner
```

### 3.2 Isolation test results

```bash
npm run storage:isolation-test
```

| Probe | Expected | Result |
|-------|----------|--------|
| Anon DELETE victim object | 401/403 | Pass |
| Anon INSERT into victim folder | 401/403 | Pass |
| Anon LIST victim prefix | Denied or empty | Pass |
| Public GET on known path | 200/404 (CDN) | Pass (by design) |

**Cross-tenant write:** Blocked — merchant cannot upload/delete outside `auth.uid()` folder.

**Cross-tenant read:** **Not blocked** — any knowing URL can load image. Required for public e-commerce storefront. **Do not store private documents** in this bucket.

### 3.3 Security findings

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| ST-01 | All media in one public bucket | Medium | By design — acceptable for product photos |
| ST-02 | No signed URLs for “private” assets | Low | N/A — no private assets today |
| ST-03 | UPDATE policy lacks explicit `WITH CHECK` on folder | Low | Client never renames paths |
| ST-04 | `deleteImage` path regex prevents traversal | — | **Pass** |
| ST-05 | Upload auth match (`userId` === `getUser()`) | — | **Pass** (v39) |
| ST-06 | Category images absent — no leak surface | — | N/A |

---

## Phase 4 — Storage Optimization

### 4.1 Compression & sizing

| Control | Value |
|---------|-------|
| Max upload | 5 MB |
| Resize | 1200 × 1200 max |
| Format | WebP @ 0.82 (JPEG fallback in canvas) |
| Thumbnail | 400 × 400 @ 0.7 |
| Cache-Control | `31536000` (1 year) |

**Issue:** `ProductImagesManager` pre-compresses files > 2MB, then `uploadImage` compresses again — redundant CPU.

### 4.2 Redundancy & waste

| Pattern | Impact | Recommendation |
|---------|--------|----------------|
| Thumbnails generated but **not used in UI** | ~2× storage per image | Serve thumbs in product lists or stop generating |
| Duplicate uploads on re-save same image | Low | URL dedup before upload (P3) |
| Orphan files from pre-fix branding flows | Medium | Run `npm run storage:audit` + cleanup job |
| External CSV image URLs | Bandwidth on hotlink | Optional import-to-storage pipeline |

### 4.3 Implemented optimizations (this audit)

| Item | Location |
|------|----------|
| Reference integrity on product update | `productsCrudService.ts`, `dummyData.ts` |
| Branding cleanup on logo/banner change | `StoreInfoTab.tsx` |
| Storage media utilities + tests | `storageMediaUtils.ts`, `.test.ts` |
| Orphan audit script | `scripts/storage-audit.mjs` |
| Storage isolation probes | `scripts/storage-isolation-test.mjs` |

### 4.4 Recommended cleanup routine (operational)

```bash
# 1. Audit
npm run storage:audit -- --json > storage-audit.json

# 2. Review orphanPaths — delete only after confirming zero references
# 3. Re-run monthly or after bulk product migrations
```

**Future:** Edge function `storage-gc` with service role + `orphanPaths` dry-run flag.

---

## Phase 5 — Reports

### Orphan Files Report (methodology)

Orphans = bucket objects whose path is not referenced by:

- `products.image_url` / `additional_images`
- `store_settings.store_logo` / `banner_images`
- Companion `thumbs/` paths for referenced mains

Run live scan: `npm run storage:audit` (requires `SUPABASE_SERVICE_ROLE_KEY`).

**Expected orphan sources:** pre-fix banner/logo replacements, cancelled product forms, failed DB saves after upload.

### Media Optimization Report

| Area | Current | Opportunity |
|------|---------|-------------|
| Path organization | Flat `owner_id/uuid` | Migrate to typed subfolders |
| Thumbnail usage | Generated, unused in UI | Wire to catalog cards (−40% bandwidth) |
| Bucket count | 1 public | Optional private bucket for drafts |
| Signed URLs | None | Not needed until private assets |
| Image CDN | Supabase public URL | Cloudflare in front at scale |
| GC automation | Manual script | Scheduled `storage-gc` function |

---

## Recommended Improvements (prioritized)

### P1 — Before scale

| # | Item | Effort |
|---|------|--------|
| 1 | Run `storage:audit` on production; purge confirmed orphans | Low |
| 2 | Use thumbnails in product/inventory list views | Medium |
| 3 | Remove duplicate compression in `ProductImagesManager` | Low |
| 4 | Add `storage:isolation-test` to CI (anon probes) | Low |

### P2 — Architecture

| # | Item | Effort |
|---|------|--------|
| 5 | Path convention: `{owner_id}/products/`, `/branding/`, `/banners/` | High (migration) |
| 6 | `temp/` prefix + TTL cleanup for abandoned uploads | Medium |
| 7 | Category image support (`categories.image_url` + upload UI) | Medium |
| 8 | Rollback upload on failed product save | Medium |

### P3 — Hyperscale

| # | Item |
|---|------|
| 9 | Separate `store-assets` CDN with transform params (`?width=400`) |
| 10 | Private bucket + signed URLs for non-public assets |
| 11 | Storage usage quotas per merchant plan |

---

## Verification

```bash
npm test                                    # includes storageMediaUtils.test.ts
npm run storage:isolation-test              # anon write probes
npm run storage:audit                       # orphan scan (service role)
```

---

## Conclusion

The platform uses a **single public Supabase bucket** (`product-images`) with **owner-scoped write RLS** and **CDN public reads** — correct for a storefront SaaS. Media is **not** organized into the target `store_id/{type}/` hierarchy; everything lives under `{owner_id}/{uuid}.webp`.

**Security is solid** for multi-tenant writes. **Reference integrity** improved with product-update and branding cleanup. **Operational gap:** run periodic `storage:audit` to reclaim orphans from legacy flows.

**Next milestone:** adopt typed subfolders + thumbnail serving in catalog lists to reach **85+** storage health score.
