# Read Replica Deployment Guide

Enable read scaling with environment variables only — no code changes required.

## Step 1 — Provision read replica

Configure Supabase (or self-hosted PostgreSQL) read replica with PostgREST pointing at the replica.

## Step 2 — Set environment variables

```env
# Standard read replica (same region)
VITE_SUPABASE_READ_REPLICA_URL=https://your-replica.supabase.co

# Optional: regional replica (multi-region)
VITE_SUPABASE_REGIONAL_REPLICA_URL=https://eu-replica.supabase.co
VITE_READ_REPLICA_REGION=eu-west

# Recommended with replicas
VITE_SUPABASE_POOLER_URL=https://your-project.supabase.co
VITE_STOREFRONT_EDGE_ENABLED=true
VITE_CDN_BASE_URL=https://cdn.example.com
```

## Step 3 — Apply migration v81

```bash
npm run db:deploy
```

## Step 4 — Verify

```bash
npm run audit:read-replica
# With service role key in .env:
# SELECT platform_read_replica_audit();
```

## Routing behavior

| Read type | Route when replica configured |
|-----------|------------------------------|
| Storefront pages | Edge → Regional → Replica → Primary |
| Dashboard / stats | Client cache → Replica → Primary |
| Checkout / payment | **Primary always** |
| Coupon validation | **Primary always** |

Replica failures automatically fall back to primary with `read_replica.fallback_to_primary` logs.

## Multi-region

Deploy SPA near users; set `VITE_SUPABASE_REGIONAL_REPLICA_URL` to the nearest regional replica. Primary writes still go to the main region.
