# Security Audit Report

**Date:** 2026-06-19  
**Scope:** Authentication, authorization, RLS, APIs, storage, secrets, environment variables

---

## Executive summary

The platform has **strong server-side tenant isolation** (RLS + SECURITY DEFINER RPCs). Client route guards are UX-only; enforcement is in PostgreSQL.

| Severity | Found | Fixed in this audit |
|----------|-------|---------------------|
| P0/P1 | 4 | 4 |
| P2 | 6 | 4 |
| P3 | 8 | 2 (documented) |

**Deploy:** `npm run db:deploy` (migration **v31**) + redeploy edge functions (`meta-conversions`, `redeem-access-code`).

> **Latest audit:** [`SECURITY_AUDIT_REPORT.md`](./SECURITY_AUDIT_REPORT.md) — score **89/100**, migration **v39**.

---

## 1. Authentication

| Finding | Severity | Status |
|---------|----------|--------|
| Session in `localStorage` when "remember me" | P2 | Documented — mitigate with CSP + XSS hygiene |
| Public `register()` still callable | P2 | **Fixed** — blocked in production (`AuthContext`) |
| Client-only login rate limit | P2 | Documented — Supabase Auth limits are authoritative |
| Password policy (8 chars only) | P3 | Documented |
| PKCE password recovery | OK | — |

---

## 2. Authorization

| Finding | Severity | Status |
|---------|----------|--------|
| `ProtectedRoute` / `AdminRoute` client-only | P2 | By design — RLS + `is_platform_admin()` enforce |
| `get_my_subscription()` for access | OK | — |
| Merchant fetches scoped by `owner_id` | OK | `orderService`, `productsCrudService` |

---

## 3. RLS (PostgreSQL)

| Table | Policy | Status |
|-------|--------|--------|
| `products`, `orders` | `tenant_row_owned(owner_id, store_id)` | OK |
| `customers` | Owner-only | OK |
| `store_settings` | `auth.uid() = owner_id` | OK |
| `leads`, `subscriptions`, `platform_admins` | `is_platform_admin()` | OK |
| `marketing_settings` | Owner-scoped; token not in public SELECT | OK |
| `merchant_access_codes` | Deny-all RLS; edge uses service role | OK |

---

## 4. IDOR & data exposure

| Finding | Severity | Status |
|---------|----------|--------|
| Storefront RPCs returned `to_jsonb(p.*)` — **leaked `cost`, `owner_id`** | **P1** | **Fixed v31** — `storefront_product_json()` |
| `get_store_bundle` exposed full settings + products | P1 | **Fixed v31** |
| Order fetch by URL id | OK | Always `.eq('owner_id', ownerId)` |
| Product fetch by id | OK | Owner filter in service layer |
| `get_store_meta` exposes `owner_id` UUID | P3 | Accepted — needed for cache keys; UUID not secret |

---

## 5. APIs & edge functions

| Function | Issue | Fix |
|----------|-------|-----|
| `meta-conversions` | No auth header; error details leaked | **Fixed** — Bearer required, CORS lockdown, no Meta error body to client |
| `meta-conversions` | Replay to Meta API | **Fixed v31** — `meta_conversion_sent_at` + `mark_meta_conversion_sent` |
| `redeem-access-code` | `Access-Control-Allow-Origin: *` | **Fixed** — shared `getEdgeCorsHeaders()` |
| `payment-webhook` | — | OK — Stripe HMAC verified |
| `get-store-products` | — | OK — production `ALLOWED_ORIGINS` |

### RPC hardening (v31)

- `get_store_product_by_id` → `storefront_product_json(p)`
- `get_checkout_products_by_ids` → slim JSON
- `verify_order_for_meta_conversion` → rejects `already_sent`
- `mark_meta_conversion_sent` → service_role only

---

## 6. Storage

| Finding | Severity | Status |
|---------|----------|--------|
| `product-images` public read | P3 | Expected for CDN |
| Write policies require `auth.uid() = folder[1]` | OK | — |
| Upload paths use `{userId}/{uuid}` | OK | — |

---

## 7. Secrets & environment

| Finding | Severity | Status |
|---------|----------|--------|
| No committed service role keys | OK | — |
| `VITE_*` only publishable keys in schema | OK | — |
| Observability webhook in client bundle | P2 | **Fixed** — disabled in production unless `VITE_OBSERVABILITY_CLIENT_ENABLED=true` |
| Local backup exported checkout keys | P3 | **Fixed** — redact idempotency/token keys |

---

## 8. Fixes applied (files)

| File | Change |
|------|--------|
| `supabase/migrations/20260625000021_security_hardening.sql` | Storefront column projection, meta dedup |
| `supabase/functions/meta-conversions/index.ts` | Auth header, CORS, rate limits, no leak |
| `supabase/functions/redeem-access-code/index.ts` | Production CORS |
| `supabase/functions/_shared/cors.ts` | Shared CORS helper |
| `src/context/AuthContext.tsx` | Block public register in production |
| `src/main.tsx` + `src/lib/env.ts` | Observability opt-in |
| `src/services/storefrontProductService.ts` | Remove dead RLS-blocked fallback |
| `src/lib/disasterRecovery/localBackup.ts` | Redact sensitive storage keys |
| `.env.example` | Security notes |

---

## 9. Remaining recommendations

1. **Supabase Auth** — disable public email signup in dashboard (access-code flow only).
2. **Edge secrets** — set `ALLOWED_ORIGINS` in production for all functions.
3. **CSP headers** — add Content-Security-Policy via hosting (Netlify/Vercel/nginx).
4. **Marketing tabs** — move direct Supabase writes into services (authorization consistency).
5. **Typed RPCs** — reduce `(supabase as any).rpc` surface.
6. **Username enumeration** — rate-limit `is_username_available` RPC at DB level.

---

## 10. Verification

```bash
npm run typecheck
npm test
npm run db:deploy          # v31
npm run functions:deploy-meta   # meta-conversions
# Redeploy redeem-access-code after CORS change
```

Manual checks:
- Storefront product detail: response must **not** include `cost` or `owner_id`.
- Meta conversion: second invoke for same order returns `already_sent`.
- Production register: returns Arabic error directing to request-access.
