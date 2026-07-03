# Inventory Management — Redesign Report

**Date:** 2026-07-03  
**Scope:** Merchant inventory hub (`/inventory`)  
**Approach:** Product-owner + UX-first redesign within existing backend capabilities, with a clear roadmap for premium SaaS features.

---

## 1. UX Problems Found

| Problem | Impact |
|--------|--------|
| KPI cards showed numbers only — no lifecycle, profit, or data-quality context | Merchant had to mentally combine Products + Inventory pages |
| No alert center — low stock only via a thin banner | Critical issues (out of stock, missing SKU/image) were easy to miss |
| Search limited to name/category, client-side only | Slow mental search; SKU not searchable; server search unused |
| Card-only layout — no dense table for power users | High-SKU merchants scroll excessively |
| No bulk selection or batch export | Repetitive work for catalogs >50 items |
| No quick actions bar | Add product / receive stock / export buried in header |
| Inventory value = retail only | No cost/profit view despite `cost` column in DB |
| Integrity audit RPC existed but had zero UI | Data mismatches invisible to merchants |
| No saved filters or search history | Repeated filter setup every visit |
| No insights (fast movers, high value, etc.) | Merchant couldn't answer "what needs attention first?" in 3 seconds |
| Variant/SKU/image quality invisible on inventory page | Operational gaps only found when editing products |

---

## 2. Design Improvements Made

### Information hierarchy (3-second rule)
1. **Quick actions** — add, receive stock, export, import (top)
2. **Alert center** — urgency-sorted issues with one-click filters
3. **Rich KPI cards** — context rows under each metric
4. **Insights strip** — prioritized product groups
5. **Smart toolbar** — search, filters, view toggle
6. **List** — cards or table

### Visual design
- Rounded 2xl cards, soft borders, hover states (aligned with dashboard `ds-*` tokens)
- Urgency-colored alert rows (critical → low)
- Sticky table columns on desktop for RTL scanability
- Floating bulk action bar (mobile-safe bottom offset)
- Skeleton loading grid instead of spinner-only state

### Cognitive load
- Filters grouped: stock pills → category/lifecycle/sort → advanced sheet
- Preset filters saved to `localStorage`
- Recent searches surfaced on focus
- Insight cards apply a one-click subset filter

---

## 3. Features Added

| Feature | Implementation |
|---------|----------------|
| **Rich stat cards** | Products (published/draft/archived/variants), Stock (good/low/out/units), Value (retail/cost/profit/margin), Data quality (missing SKU/image/integrity/alerts) |
| **Quick actions bar** | Add product, Receive stock (opens first low-stock item), Export, Import → Products, Count/Scan/Transfer (marked "قريباً") |
| **Alert center** | Computed alerts + integrity score from `auditInventoryIntegrity` RPC |
| **Insights panel** | Needs restock, highest inventory value, best margin, recently added, missing images |
| **Smart search** | Name, category, SKU + simple fuzzy match; debounced server search via `useMerchantProductsPage` |
| **Recent searches** | `localStorage` persistence |
| **Advanced filters** | Image, variants, missing SKU, price range, quantity range |
| **Saved filter presets** | Up to 6 presets in `localStorage` |
| **Table view** | Image, name, SKU, category, qty, min, retail value, profit, status, actions |
| **Bulk select + bar** | Export selected; bulk restock opens first item (batch RPC planned) |
| **Enhanced CSV** | SKU, cost, retail value, cost value, expected profit |
| **SKU on cards** | Shown next to category when present |
| **Extended catalog select** | `sku`, `cost`, `updated_at` in inventory profile query |

---

## 4. Features Removed / Not Added (and Why)

| Item | Reason |
|------|--------|
| Manual stock deduction UI | **By design** — platform policy: deduct on order only; prevents ledger abuse |
| Multi-warehouse / transfers (functional) | **No DB schema** — would be fake UI; shown as "قريباً" |
| Purchase orders, suppliers, barcode scan | **No backend** — requires new tables + RPCs |
| Reserved / incoming stock columns | **No reservation model** — would mislead merchants |
| Virtualized table | **Deferred** — progressive render + pagination sufficient at current scale; add `@tanstack/react-virtual` when catalog >500 visible rows |
| Full analytics charts (ABC, turnover) | **Needs time-series RPC** — insights strip is phase-1 substitute |
| Per-variant targeted restock | **RPC scales proportionally** — UI still shows breakdown; targeted restock needs backend |

---

## 5. Performance Improvements

- Server-side search wired (`debouncedSearch` → catalog hook) — reduces client-only filtering on large catalogs
- Table mode progressive render batch size increased to 100
- Memoized stats, alerts, insights, filtered lists
- Integrity audit fetched once per session (not per row)
- Existing keyset pagination + realtime cache patch preserved

---

## 6. Accessibility Improvements

- `aria-label` on view mode toggles, select-all checkbox, row checkboxes
- Minimum 44px touch targets on mobile actions
- Focus-visible rings on interactive stat cards
- RTL table direction with sticky first/last columns for action column
- Sheet-based advanced filters (bottom-friendly on mobile)

---

## 7. Business Logic Improvements

- **Profit metrics** when merchants enter `cost` on products
- **Data quality KPI** drives merchants to complete SKU/images
- **Integrity score** surfaces ledger drift before it becomes support tickets
- **Receive stock** action routes to highest-priority restock item
- **Alert → filter** wiring reduces clicks from alert to action

---

## 8. Database Improvements (Recommended — Not in This PR)

| Migration | Purpose |
|-----------|---------|
| `inventory_movements.created_by` | User attribution on adjustments |
| `stock_reservations` | Committed qty at checkout |
| `warehouses` + `warehouse_stock` | Multi-location |
| `purchase_orders` + lines | Receiving workflow |
| `products.barcode` indexed | Scan lookup |
| `batch_restock_products` RPC | Atomic bulk restock |
| `variant_restock` RPC | Target size/color delta |
| Materialized view for turnover | ABC / days-of-supply analytics |

---

## 9. API Improvements (Recommended)

| API | Purpose |
|-----|---------|
| `GET /inventory/summary` | Server-side KPIs without loading full catalog |
| `GET /inventory/alerts` | Alerts from DB + cron, not client-only |
| `GET /inventory/movements?from&to` | Global movement report |
| `POST /inventory/bulk-restock` | Batch mutation |
| `POST /inventory/adjust` | Controlled write-off with approval |
| Webhook/cron low-stock notifications | Email/WhatsApp alerts |

---

## 10. Future Enhancements (Roadmap)

### Phase 2 — High value, moderate effort
- Global movement timeline page
- Order links in movement history (`order_id` already in DB)
- Bulk restock RPC + progress UI
- Keyboard shortcuts (`/` search, `r` restock selected)
- Demand forecast from order velocity ("runs out in N days")

### Phase 3 — Premium SaaS parity
- Multi-warehouse + transfers
- Purchase orders + supplier catalog
- Cycle count sessions
- Barcode print/scan (mobile PWA)
- ABC analysis dashboard
- Automated reorder suggestions + WhatsApp alerts

### Phase 4 — Enterprise
- FIFO cost layers
- Role-based inventory permissions
- Audit log export
- API for external WMS/ERP

---

## Files Changed

| Path | Change |
|------|--------|
| `src/pages/Inventory.tsx` | Full hub orchestration |
| `src/utils/inventoryPageUtils.ts` | Stats, alerts, insights, filters, CSV |
| `src/lib/productUpdateUtils.ts` | Inventory select includes sku/cost |
| `src/components/inventory/InventoryRichStatCard.tsx` | New |
| `src/components/inventory/InventoryQuickActions.tsx` | New |
| `src/components/inventory/InventoryAlertsPanel.tsx` | New |
| `src/components/inventory/InventoryInsightsPanel.tsx` | New |
| `src/components/inventory/InventoryDataTable.tsx` | New |
| `src/components/inventory/InventoryBulkBar.tsx` | New |
| `src/components/inventory/InventoryToolbar.tsx` | Redesigned |
| `src/components/inventory/InventoryProductCard.tsx` | SKU display |
| `src/utils/inventoryPageUtils.test.ts` | Extended tests |

---

## Summary

The inventory page is now a **merchant command center** rather than a simple restock list. Phase 2 and Phase 3 features are implemented in code; **run `npm run db:deploy`** to apply migration `20260728000001_inventory_premium_platform.sql` before using server RPCs (warehouses, PO, batch restock, forecast, ABC).

---

## Phase 2 & 3 — Implemented (2026-07-03)

| Feature | Status |
|---------|--------|
| Global movement timeline | Tab «الحركات» + `list_merchant_inventory_movements` RPC |
| Order links in history | `order_id` in movement queries + links to `/orders/:id` |
| Bulk restock RPC + UI | `batch_restock_products` + `InventoryBulkRestockDialog` |
| Keyboard shortcuts | `/` search, `R` bulk restock, `Ctrl+E` export |
| Demand forecast | `merchant_inventory_forecast` RPC + Analytics tab |
| Multi-warehouse | `warehouses`, `warehouse_stock`, transfer RPC, Warehouses tab |
| Purchase orders | `suppliers`, `purchase_orders`, receive RPC, Orders tab |
| Cycle count | `inventory_cycle_counts`, start/submit/complete RPCs, dialog |
| Barcode lookup | `products.barcode` + `lookup_product_by_barcode` + scan dialog |
| ABC analysis | `merchant_abc_analysis` RPC + Analytics tab |
| Server KPIs | `merchant_inventory_summary` (reserved, incoming) |
| `created_by` on movements | Column + set in `increment_product_stock` |

### Still planned (Phase 4 / ops)
- FIFO cost layers, role-based permissions, external WMS API
- Push/WhatsApp low-stock cron notifications
- Table virtualization (`@tanstack/react-virtual`)
- Manual write-off / negative adjustment (policy decision)
