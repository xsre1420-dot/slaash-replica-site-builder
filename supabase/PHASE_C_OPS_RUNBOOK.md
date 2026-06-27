# Phase C Operations Runbook

Operational steps that cannot be fully automated in application code.

## Supabase backups & PITR

1. Enable **Point-in-Time Recovery** on the Supabase project (Pro plan).
2. Verify daily backups in **Project Settings → Database → Backups**.
3. Quarterly: restore to a staging project and run `npm run db:verify`.

## Read replica (analytics)

1. Enable read replica in Supabase when available on your plan.
2. Route heavy analytics RPCs through a dedicated connection string (`DATABASE_REPLICA_URL`).
3. Keep writes on primary only.

## Redis / shared cache (optional)

1. Provision Upstash Redis or Supabase cache tier.
2. Use for rate-limit counters and hot storefront slug → version maps.
3. Set `REDIS_URL` in edge function secrets if adopting shared edge cache.

## store_visits retention

1. After migration `20260625000058`, schedule weekly:

```sql
SELECT public.prune_store_visits(90);
```

2. Use **pg_cron** or Supabase scheduled Edge Function with service role.
3. For monthly partitioning at scale, create new partitions before high-traffic seasons.

## import_jobs worker

1. Deploy edge function: `supabase functions deploy process-import-jobs`
2. Set `ALLOWED_ORIGINS` to your production app URL(s).
3. Large CSV uploads enqueue via `enqueue_product_import_job`; client or cron calls `process-import-jobs`.

## Edge functions & CORS

```bash
supabase secrets set ALLOWED_ORIGINS=https://your-app.com,https://www.your-app.com
supabase functions deploy get-store-products process-import-jobs optimize-image payment-webhook
```

## Cloudflare CDN

1. Proxy storage public bucket through Cloudflare (custom domain).
2. Set `VITE_CDN_BASE_URL` in the frontend `.env`.
3. Optional: `IMAGE_TRANSFORM_BASE` on `optimize-image` edge function.

## Chaos drills (quarterly)

```bash
npm run db:chaos-test
npm run db:tenant-isolation
```

Document results in `supabase/chaos-reports/`.

## Realtime capacity

Upgrade Supabase Realtime plan when concurrent merchant dashboards exceed ~500 active channels.
