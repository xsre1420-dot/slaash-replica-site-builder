# Data Lifecycle & Partitioning

Enterprise database lifecycle for tens of millions of records.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Hot (0–90d)     │ store_visits, product_views, outboxes   │
│  Warm (90d–2y)   │ inventory_movements, store_daily_stats  │
│  Cold (archive)  │ orders_archive, inventory_archive       │
│  Purged          │ Old partitions DROP, outbox rows DELETE │
└─────────────────────────────────────────────────────────────┘
```

## Partitioned Tables (monthly RANGE on `created_at`)

| Table | Retention | Strategy |
|-------|-----------|----------|
| `store_visits` | 90 days | DROP partition |
| `product_views` | 90 days | DROP partition |
| `analytics_event_outbox` | 7 days processed | DROP + DELETE |
| `inventory_movements` | 2 years → archive | Archive batch |

## Archive Tables (not live-partitioned)

| Source | Archive | Trigger |
|--------|---------|---------|
| `orders` (terminal) | `orders_archive` | >548 days |
| `order_items` | `order_items_archive` | With parent |
| `inventory_movements` | `inventory_movements_archive` | >730 days |

**Why orders are archive-only:** 10+ inbound FKs; live RANGE partition would require composite PK migration across the app.

## Maintenance Schedule (pg_cron)

| Job | Schedule | Action |
|-----|----------|--------|
| `platform-ensure-partitions` | 1st of month 02:00 UTC | Create monthly child partitions |
| `platform-data-lifecycle` | Daily 04:30 UTC | Purge, archive, ANALYZE partitions |

## Ops Commands

```bash
npm run db:lifecycle-test          # Integration probes
npm run db:growth-audit            # Per-table growth + projections
npm run db:partition-scale-benchmark  # 1M–100M scale simulation

# Manual (service_role)
# POST /rest/v1/rpc/platform_run_data_lifecycle
# POST /rest/v1/rpc/platform_database_growth_audit
# POST /rest/v1/rpc/platform_lifecycle_audit
```

## Historical Data

- **Hot queries:** Merchant UI, dashboards — last 18 months of orders
- **Archive queries:** `orders_archive`, `get_merchant_order_with_archive_fallback(order_id, owner_id)`
- **Restore:** `restore_orders_from_archive(order_ids[])`

## Registry

All policies: `platform_data_lifecycle_policies` (service_role read).

See also: [`PARTITIONING_AND_DATA_LIFECYCLE_REPORT.md`](../PARTITIONING_AND_DATA_LIFECYCLE_REPORT.md)
