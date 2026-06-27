# Production Security Audit Report

**Date:** 2026-06-19  
**Role:** Senior Cybersecurity Engineer  
**Scope:** Authentication, authorization, RLS, storage, APIs, environment variables, session management

---

## Security score: **89 / 100**

| Domain | Score | Weight |
|--------|-------|--------|
| Authentication & session | 84/100 | 20% |
| Authorization & RLS | 94/100 | 25% |
| API / RPC security | 91/100 | 20% |
| Storage security | 88/100 | 10% |
| Tenant isolation | 93/100 | 15% |
| Secrets & environment | 92/100 | 10% |

**Deploy fixes:** `npm run db:deploy` (migration **v39**) + redeploy edge functions if not current.

---

## Executive summary

The platform enforces security **primarily in PostgreSQL** (RLS + `SECURITY DEFINER` RPCs with `auth.uid()` guards). Client route guards are UX-only. Store isolation has been penetration-tested (16/16 probes). This audit applied **6 safe fixes** and documents remaining P2/P3 items.

---

## 1. Security findings

### Critical / High — none open

All previously identified P0/P1 issues (storefront `cost`/`owner_id` leak, `checkout_resolve_duplicate_order` cross-tenant probe, `meta-conversions` auth bypass) were fixed in migrations v31 and v37.

### Medium — fixed in this audit (v39 + client)

| ID | Finding | Risk | Fix |
|----|---------|------|-----|
| **S-01** | `marketing_settings` / `marketing_coupons` UPDATE policies lacked `WITH CHECK` on `owner_id` | Privilege escalation via `owner_id` rewrite on UPDATE | Migration v39 adds `WITH CHECK (auth.uid() = owner_id)` |
| **S-02** | `is_username_available` callable without rate limit | Username enumeration / profile oracle | Migration v39: 30 req/min per IP + format validation |
| **S-03** | `getAuthenticatedUserId()` preferred `getSession()` (storage) over server validation | Stale/tampered session used for upload guards | `authSession.ts` now uses `getUser()` only |
| **S-04** | `uploadImage` did not verify `userId` matches authenticated user | IDOR upload to another merchant folder if caller passes wrong ID | Auth match check before upload |
| **S-05** | `deleteImage` path not validated | Path traversal / delete arbitrary bucket objects | Strict path regex + `getUser()` |
| **S-06** | Inventory/statistics services lacked client defense-in-depth | Inconsistent with `orderService` pattern | `assertMerchantOwner()` added |

### Medium — open (documented)

| ID | Finding | Risk | Mitigation |
|----|---------|------|------------|
| **S-07** | Session in `localStorage` when "remember me" | XSS → session theft | CSP headers; sanitize user content; observability off in prod |
| **S-08** | Marketing UI components call Supabase directly | Inconsistent auth layer; harder to audit | Move to `marketingService` (RLS still enforces) |
| **S-09** | `platform_health_check` exposes schema metadata | Information disclosure to authenticated users | Acceptable for merchants; revoke if unused |
| **S-10** | Public signup RPC still exists in dev | Account sprawl | Blocked in production `AuthContext`; disable in Supabase dashboard |

### Low

| ID | Finding | Notes |
|----|---------|-------|
| **S-11** | `get_store_meta` returns `owner_id` UUID | Needed for cache keys; UUID is not a secret |
| **S-12** | Password policy: 8 chars minimum | Consider 10+ and breach list in Supabase Auth |
| **S-13** | Client login rate limit is UX-only | Supabase Auth rate limits are authoritative |
| **S-14** | `list_public_store_slugs` enables slug enumeration | Required for sitemap; slugs are public |

---

## 2. Risk assessment

| Threat | Likelihood | Impact | Residual risk | Controls |
|--------|------------|--------|---------------|----------|
| **Cross-store data access (IDOR)** | Low | Critical | **Low** | RLS `owner_id`; RPC `auth.uid()` guards; tenant isolation tests 16/16 |
| **Storefront data leak (cost, margins)** | Low | High | **Low** | `storefront_product_json()` projection (v31) |
| **Checkout abuse / fraud** | Medium | High | **Medium** | Idempotency keys, rate limits, stock locks (v35) |
| **Session hijack (XSS)** | Medium | High | **Medium** | PKCE, `getUser()` validation; needs CSP |
| **Username enumeration** | Medium | Low | **Low** | Rate limit + client rate limit (v39) |
| **Storage object IDOR** | Low | Medium | **Low** | Folder = `auth.uid()`; path validation on delete |
| **Edge function abuse** | Low | Medium | **Low** | CORS lockdown, auth headers, rate limits |
| **Secret exposure in bundle** | Low | Critical | **Low** | Only `VITE_*` publishable keys; observability opt-in |
| **Privilege escalation (admin)** | Low | Critical | **Low** | `is_platform_admin()` + deny-all RLS on admin tables |
| **Meta conversion replay** | Low | Medium | **Low** | `meta_conversion_sent_at` dedup (v31) |

**Overall residual risk: LOW–MEDIUM** (dominated by XSS/session surface common to SPAs).

---

## 3. Domain review

### 3.1 Authentication

| Control | Status |
|---------|--------|
| PKCE OAuth flow | OK |
| Email verification flow | OK |
| Password recovery via secure callback | OK |
| Production `register()` blocked client-side | OK |
| Access-code redemption via edge function | OK |
| `getUser()` for security-sensitive guards | **Fixed S-03** |
| Logout tears down Realtime hub | OK (realtime audit) |

### 3.2 Authorization

| Layer | Enforcement |
|-------|-------------|
| `ProtectedRoute` / `AdminRoute` | Client UX only |
| `useSubscription` / `get_my_subscription()` | Server-backed access |
| `assertMerchantOwner()` | Client defense-in-depth (`orderService`, inventory, statistics) |
| Platform admin | `is_platform_admin()` in RLS |

### 3.3 RLS policies

| Table class | Policy pattern |
|-------------|----------------|
| Merchant data (`products`, `orders`, `customers`, …) | `owner_id = auth.uid()` or `tenant_row_owned()` |
| Platform (`leads`, `subscriptions`, `platform_admins`) | `is_platform_admin()` |
| Rate limit internals (`rpc_rate_limits`) | Deny all |
| `merchant_access_codes` | Deny all; edge service role only |

**v39:** Marketing tables UPDATE now include `WITH CHECK` on `owner_id`.

### 3.4 Storage permissions

| Bucket | Read | Write | Delete |
|--------|------|-------|--------|
| `product-images` | Public (CDN) | `auth.uid() = folder[1]` | Same |

Upload path: `{userId}/{uuid}.ext` with auth verification. Delete: owner folder match + path regex.

### 3.5 API security

| API class | Auth | Tenant guard |
|-----------|------|--------------|
| Merchant RPCs (`get_store_statistics`, `list_merchant_orders`, …) | `authenticated` | `auth.uid() = p_owner_id` |
| Storefront RPCs | `anon` + slug | Slug → owner resolution inside RPC |
| Internal (`checkout_resolve_duplicate_order`) | `service_role` only | v37 |
| Checkout (`create_order_with_stock_deduction`) | `anon` | Rate limit + `resolve_checkout_owner` |
| Edge: `meta-conversions` | Bearer required | CORS + order verification RPC |
| Edge: `payment-webhook` | Stripe HMAC | OK |

### 3.6 Environment variables

| Variable class | Exposure | Status |
|----------------|----------|--------|
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client bundle | Expected (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge/server only | Not in repo |
| `VITE_OBSERVABILITY_WEBHOOK_URL` | Client if enabled | Disabled in prod unless explicit flag |
| Zod validation on startup | — | Fails hard in production |

### 3.7 Session management

| Aspect | Implementation |
|--------|----------------|
| Token storage | `localStorage` / session per remember-me |
| Auto refresh | `autoRefreshToken: true` |
| Session invalidation on logout | `signOut()` + hub teardown + cache flush |
| Failover client swap | `resetSupabaseClient()` + hub teardown |

---

## 4. Verification checklist

### Store isolation

```bash
npm run db:isolation-test   # 16/16 probes
```

### Automated

```bash
npm test
npm run typecheck
npm run db:deploy           # v39
```

### Manual

- [ ] Storefront product JSON: no `cost`, `owner_id` in response
- [ ] Merchant A cannot read Merchant B orders via PostgREST
- [ ] Upload to `{otherUserId}/` path fails RLS
- [ ] `get_store_for_user(victim_id)` returns null when logged in as attacker
- [ ] Production signup shows access-code message
- [ ] Meta conversion: duplicate order returns `already_sent`

---

## 5. Fixes applied (this audit)

| File | Change |
|------|--------|
| `supabase/migrations/20260625000029_security_audit_fixes.sql` | Marketing RLS WITH CHECK; username rate limit |
| `src/lib/authSession.ts` | `getUser()` only |
| `src/utils/imageUpload.ts` | Auth match + safe path validation |
| `src/services/inventoryService.ts` | `assertMerchantOwner` |
| `src/services/statisticsService.ts` | `assertMerchantOwner` |

---

## 6. Recommendations (prioritized)

| Priority | Action |
|----------|--------|
| **P1** | Disable public email signup in Supabase Auth dashboard (production) |
| **P1** | Set `ALLOWED_ORIGINS` on all edge functions in production |
| **P2** | Add Content-Security-Policy via hosting (Netlify/Vercel/nginx) |
| **P2** | Migrate marketing components to service layer |
| **P2** | Strengthen password policy in Supabase Auth settings |
| **P3** | Typed RPC wrappers (reduce `as any`) |
| **P3** | Periodic re-run `db:isolation-test` in CI |

---

## 7. Score breakdown rationale

**Strengths (+):**

- Defense-in-depth tenant model (`owner_id` + RLS + RPC auth)
- Incremental hardening across 39 migrations
- Checkout idempotency, rate limits, internal RPC lockdown
- Storefront column projection prevents margin leak
- No service role key in client bundle

**Deductions (−):**

- SPA session in `localStorage` (−4)
- Some direct Supabase usage in components (−3)
- Password policy minimal (−2)
- No CSP documented in repo (−2)

---

**Related:** [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) (v31 edge/storefront fixes) · [`TENANT_ISOLATION_AUDIT.md`](./TENANT_ISOLATION_AUDIT.md)
