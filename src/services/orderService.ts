/**
 * Legacy order service facade — preserves import paths while routing to read/write layers.
 */
export {
  ORDERS_PER_PAGE,
  ORDER_LIST_SELECT,
  fetchOrdersPage,
  fetchOrdersFiltered,
  fetchWorkflowTabCounts,
  fetchRecentOrders,
  fetchOrdersPageLegacy,
  fetchCustomerInsightsByPhone,
  fetchOrderStatsRows,
  fetchOrderStatsSummary,
} from '@/services/read/orders/orderReadService';

export {
  createOrder,
  updateOrderStatus,
  clearInflightOrdersForTests,
  type CreateOrderResult,
} from '@/services/write/orders/orderWriteService';
