import type { OrderWorkflowTab } from '@/utils/orderWorkflowUtils';
import { computeOrderStats } from '@/utils/orderWorkflowUtils';

/** Per-tab order counts from `count_merchant_orders_by_workflow` RPC. */
export type WorkflowTabCounts = Record<OrderWorkflowTab, number>;

/** Merchant dashboard order KPIs (list totals, revenue, period counts). */
export type OrderDashboardStats = ReturnType<typeof computeOrderStats>;
