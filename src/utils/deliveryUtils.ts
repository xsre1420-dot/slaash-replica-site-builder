export type DeliveryStatus =
  | 'pending'
  | 'preparing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned';

export interface DeliveryPrice {
  governorate: string;
  price: number;
}

export const getDeliveryStatusLabel = (status?: string): string => {
  switch (status) {
    case 'pending': return 'بانتظار التجهيز';
    case 'preparing': return 'قيد التجهيز';
    case 'shipped': return 'تم الشحن';
    case 'out_for_delivery': return 'في الطريق';
    case 'delivered': return 'تم التسليم';
    case 'failed': return 'فشل التوصيل';
    case 'returned': return 'مرتجع';
    default: return status || 'غير معروف';
  }
};

export const DELIVERY_STATUS_OPTIONS: { value: DeliveryStatus; label: string }[] = [
  { value: 'pending', label: 'بانتظار التجهيز' },
  { value: 'preparing', label: 'قيد التجهيز' },
  { value: 'shipped', label: 'تم الشحن' },
  { value: 'out_for_delivery', label: 'في الطريق' },
  { value: 'delivered', label: 'تم التسليم' },
  { value: 'failed', label: 'فشل التوصيل' },
  { value: 'returned', label: 'مرتجع' },
];

export const calculateDeliveryFeeFromPrices = (
  deliveryPrices: DeliveryPrice[] | undefined,
  governorate?: string
): number => {
  if (!governorate?.trim() || !deliveryPrices?.length) return 0;
  const match = deliveryPrices.find((d) => d.governorate === governorate);
  return match?.price ?? 0;
};

export const computeOrderTotal = (
  subtotal: number,
  deliveryFee: number,
  discountAmount = 0
): number => Math.max(0, subtotal - discountAmount) + deliveryFee;
