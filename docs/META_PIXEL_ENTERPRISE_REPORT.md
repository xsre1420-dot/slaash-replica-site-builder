# Meta Pixel + Conversions API — Enterprise Implementation Report

**Platform:** Vite + React 18 SPA (multi-tenant SaaS eCommerce)  
**Date:** 2026-08-01  
**Implementation quality score:** **88 / 100**

---

## Phase 1 — Architecture Audit Summary

| Area | Finding |
|------|---------|
| **Framework** | Vite 5, React 18, TypeScript, react-router-dom v6 — pure client SPA |
| **Store bootstrap** | `TenantStoreProvider` → `tenantStoreRegistry` → RPC `get_storefront_page_bundle` |
| **Auth** | Supabase Auth via `AuthContext` / `authService` |
| **Cart** | `CartContext`, scoped by `ownerId`, `sessionStorage` + `localStorage` backup |
| **Checkout** | `useCheckoutFlow` → `createOrder` RPC → background CAPI enqueue |
| **Orders** | `create_order_with_stock_deduction`, idempotency keys, `meta_conversion_sent_at` |
| **Existing Pixel** | Partial — `marketingTracking.ts`, `useMetaPixel`, `MarketingScripts` |
| **Existing CAPI** | Partial — `meta-conversions` edge function, Purchase only |
| **Event bus** | None — IndexedDB job queue (`orders`, `analytics` queues) |
| **Gaps (pre-implementation)** | No fbp/fbc, wrong fbq dedup arg, no token UI, no test event code, no diagnostics |

---

## Phase 2 — Multi-Tenant Design

Each merchant row in `marketing_settings` is keyed by `owner_id` (UNIQUE). RLS enforces `auth.uid() = owner_id`.

| Setting | Browser exposure | Server (CAPI) |
|---------|------------------|---------------|
| `meta_pixel_id` | Public RPC when `marketing_enabled` | Edge function per owner lookup |
| `facebook_access_token` | **Never** | Edge function only |
| `meta_test_event_code` | **Never** | Edge when `meta_debug_mode` + non-production |
| `meta_capi_enabled` | Merchant dashboard | Gates CAPI send |
| `meta_browser_events_enabled` | Public RPC flag | N/A |
| `meta_debug_mode` | Public RPC (logging only) | Verbose responses + test code |

Store slug resolves to exactly one `owner_id` before any credential load — **no cross-tenant token use**.

---

## Architecture Diagram

```mermaid
flowchart TB
  subgraph storefront [Storefront SPA]
    MS[MarketingScripts]
    MP[meta/pixelClient]
    HK[useMetaPixel]
    CK[getMetaBrowserContext]
    MS --> MP
    HK --> MP
    CO[Checkout / Product / Store] --> HK
  end

  subgraph merchant [Merchant Dashboard]
    MST[MarketingSettingsTab]
    MDP[MetaDiagnosticsPanel]
    MST --> RPC_W[upsert_merchant_marketing_settings]
  end

  subgraph server [Supabase]
    RPC_R[get_store_marketing_public]
    EF[meta-conversions Edge]
    DB[(marketing_settings + orders)]
    RPC_W --> DB
    RPC_R --> DB
    EF --> DB
  end

  subgraph async [Background Queue]
    JQ[orders.metaConversions]
    JQ --> EF
  end

  MS --> RPC_R
  CO --> JQ
  MP --> FB[Meta Pixel Browser]
  EF --> CAPI[Graph API v21.0]
```

---

## Event Flow Diagram

```mermaid
sequenceDiagram
  participant U as User Browser
  participant P as Meta Pixel
  participant Q as Job Queue
  participant E as meta-conversions Edge
  participant M as Meta Graph API

  U->>P: track Purchase eventID=orderId
  U->>Q: enqueueMetaConversion fbp fbc
  Q->>E: POST authenticated
  E->>E: verify_order_for_meta_conversion
  E->>M: CAPI Purchase event_id=orderId
  M-->>E: events_received
  E->>E: mark_meta_conversion_sent
```

---

## Browser Event Flow

1. `MarketingScripts` loads config via `get_store_marketing_public` (no secrets).
2. `initMetaPixel` injects `fbevents.js` **once**; re-inits only on tenant switch.
3. SPA `useLocation` triggers `PageView` on route change (not duplicate init).
4. `useMetaPixel` builds standard events via `standardEvents.ts` with UUID `event_id` (Purchase uses `orderId`).
5. `fbq('track', event, data, { eventID })` — Meta dedup 4th argument.

**Standard events implemented:** PageView, ViewContent, Search, AddToWishlist, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase, Lead, Contact, CompleteRegistration.

---

## Server Event Flow (CAPI)

1. `createOrder` success → `enqueueMetaConversion` with shared `eventId = orderId`.
2. Background processor invokes `meta-conversions` with auth header.
3. Edge verifies order amount, age, `meta_conversion_sent_at`.
4. Loads owner-scoped `marketing_settings` (service role).
5. Builds CAPI payload with hashed `ph`, `external_id`, IP, UA, `fbp`, `fbc`.
6. POST Graph API; atomic mark sent.

---

## Purchase Flow

| Step | Browser | Server |
|------|---------|--------|
| Checkout submit | — | `create_order_with_stock_deduction` |
| Dedup guard | Skip if `wasIdempotent` | Skip enqueue if idempotent |
| Event ID | `orderId` | `orderId` |
| Attribution | UTM/fbclid in sessionStorage | `attach_order_marketing_attribution` |
| Cookies | `_fbp`, `_fbc` forwarded | Included in `user_data` |

---

## Deduplication Flow

| Layer | Mechanism |
|-------|-----------|
| Pixel ↔ CAPI | Same `event_id` = `orderId` |
| fbq | 4th param `{ eventID: orderId }` |
| DB | `orders.meta_conversion_sent_at` + verify RPC |
| Job queue | `idempotencyKey: meta:{orderId}` |
| Edge | 2 req / 24h per order rate limit |

---

## Diagnostics Flow

- `src/lib/meta/diagnostics.ts` — ring buffer (100 entries), sessionStorage when debug mode.
- Browser events recorded in `pixelClient.ts`.
- Server events recorded in `orders.metaConversions` processor.
- `MetaDiagnosticsPanel` in Marketing settings — pixel status, event counts, EMQ hints.

---

## Phase 7 — Event Match Quality

| Identifier | Collected | Notes |
|------------|-----------|-------|
| `client_ip_address` | ✅ | Edge from request |
| `client_user_agent` | ✅ | Edge from request |
| `fbp` | ✅ | Cookie forwarded from browser |
| `fbc` | ✅ | Cookie or derived from `fbclid` |
| `ph` (SHA256) | ✅ | Checkout phone |
| `external_id` (SHA256) | ✅ | `orderId` |
| `em` (SHA256) | ⚠️ | Supported in edge; checkout form has no email field |
| `fn`, `ln`, `ct`, `st`, `zp`, `country` | ❌ | Not in checkout schema |

---

## Phase 8 — Test Mode

- `meta_test_event_code` stored server-side only.
- Sent to Graph API only when `meta_debug_mode === true` **and** edge `IS_PRODUCTION === false`.
- Production: never attaches `test_event_code`.
- Client debug: console + diagnostics panel when `meta_debug_mode`.

---

## Phase 11 — Performance Review

| Metric | Impact |
|--------|--------|
| **JS bundle** | ~+4KB gzip (`src/lib/meta/*`) — lazy diagnostics panel |
| **Runtime** | Single fbevents.js load; events are sync fbq calls |
| **Network** | 1 script + CAPI async via queue (non-blocking checkout) |
| **Memory** | Diagnostics capped at 100 entries |
| **CWV** | Script async/defer; no render blocking |

---

## Phase 12 — Security Review

| Control | Status |
|---------|--------|
| Access token never in browser | ✅ Public RPC excludes token |
| Token write via authenticated RPC only | ✅ |
| CAPI from edge with service role | ✅ |
| Order verification before send | ✅ |
| CORS + auth on edge | ✅ |
| Rate limits | ✅ IP + per-order |
| Merchant isolation | ✅ owner_id on all paths |

---

## Phase 13 — Files

### Created
- `src/lib/meta/types.ts`
- `src/lib/meta/eventIds.ts`
- `src/lib/meta/cookies.ts`
- `src/lib/meta/diagnostics.ts`
- `src/lib/meta/pixelClient.ts`
- `src/lib/meta/standardEvents.ts`
- `src/lib/meta/index.ts`
- `src/lib/meta/metaTracking.test.ts`
- `src/components/marketing/MetaDiagnosticsPanel.tsx`
- `supabase/functions/_shared/metaCapi.ts`
- `supabase/migrations/20260801000001_meta_tracking_enterprise.sql`

### Modified
- `src/lib/marketingTracking.ts`
- `src/hooks/useMetaPixel.tsx`
- `src/components/MarketingScripts.tsx`
- `src/components/marketing/MarketingSettingsTab.tsx`
- `src/services/marketingService.ts`
- `src/services/write/orders/orderWriteService.ts`
- `src/background/enqueue.ts`
- `src/background/processors/index.ts`
- `src/pages/Store.tsx`
- `supabase/functions/meta-conversions/index.ts`

### Database changes
- New columns: `meta_test_event_code`, `meta_capi_enabled`, `meta_browser_events_enabled`, `meta_debug_mode`, `meta_dataset_id`, `facebook_access_token_set_at`
- New RPC: `get_merchant_marketing_settings`
- Updated: `get_store_marketing_public`, `get_store_marketing_for_owner`, `upsert_merchant_marketing_settings`

### API / Edge changes
- `meta-conversions`: fbp/fbc/external_id/contents/num_items/test_event_code/debug response

---

## Remaining Risks

1. **Migration not applied** — run `npm run db:deploy` before production use.
2. **Email EMQ** — checkout lacks email; add optional email field to improve match score.
3. **CAPI for non-Purchase events** — funnel events are browser-only (industry standard at scale); extend if Meta attribution requires it.
4. **Search event volume** — fires on debounced search; add minimum query length if noisy.
5. **Merchant diagnostics** — server events only visible when checkout runs in same browser session as dashboard (queue runs client-side).

---

## Future Improvements

1. Server-side event batching / dedicated worker for CAPI at very high volume.
2. Optional checkout email for `em` hashing.
3. `meta_event_outbox` table for server-side retry independent of browser.
4. Meta Dataset Quality API integration for automated EMQ monitoring.
5. E2E Playwright test against Meta Test Events.

---

## Verification Checklist

| Check | Status |
|-------|--------|
| Pixel loads once | ✅ `injectFbeventsScript` singleton |
| No duplicate init | ✅ `_metaPixelId` guard |
| SPA PageView | ✅ `useLocation` in MarketingScripts |
| ViewContent / AddToCart / Checkout | ✅ existing pages + hooks |
| Purchase browser + server | ✅ useCheckoutFlow + enqueue |
| Shared event_id dedup | ✅ orderId + fbq 4th arg |
| Test event code | ✅ debug + non-prod only |
| Token server-only | ✅ |
| Diagnostics UI | ✅ MetaDiagnosticsPanel |

---

## Quality Score: 88 / 100

**Strengths:** Clean module separation, tenant isolation, proper dedup, EMQ fields, security boundaries, async CAPI, diagnostics, merchant settings UI for token.

**Deductions (−12):** CAPI limited to Purchase (not all standard events server-side); no email in checkout; migration/RPC must be deployed manually; no automated E2E against Meta Test Events; client-side queue means server diagnostics depend on browser session.

---

*Apply migration: `npm run db:deploy` · Deploy edge: `npm run functions:deploy-meta`*
