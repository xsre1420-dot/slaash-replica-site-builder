/**
 * Legacy delivery service facade.
 */
export {
  fetchDeliveryFee,
  fetchDeliveryFeeBySlug,
  fetchOrderShipment,
  type ShipmentTrackingEvent,
  type ShipmentInfo,
  type OrderShipmentData,
} from '@/services/read/delivery/deliveryReadService';

export {
  updateShipmentStatus,
  markDeliveryFailed,
  retryFailedDelivery,
} from '@/services/write/delivery/deliveryWriteService';
