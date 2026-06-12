export type PaymentMethodId = 'cash_on_delivery' | 'credit_card' | 'digital_wallet';

export type PaymentStatus =
  | 'pending_collection'
  | 'collected'
  | 'awaiting_gateway'
  | 'paid'
  | 'failed'
  | 'partially_refunded'
  | 'refunded'
  | 'disputed';

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
  enabled: boolean;
  available: boolean;
}

const METHOD_META: Record<PaymentMethodId, { label: string; description: string; gatewayRequired: boolean }> = {
  cash_on_delivery: {
    label: 'الدفع عند الاستلام',
    description: 'ادفع نقداً عند استلام الطلب',
    gatewayRequired: false,
  },
  credit_card: {
    label: 'بطاقة ائتمان',
    description: 'فيزا / ماستركارد (قريباً)',
    gatewayRequired: true,
  },
  digital_wallet: {
    label: 'محفظة إلكترونية',
    description: 'زين كاش، آسيا حوالة، إلخ',
    gatewayRequired: false,
  },
};

export const parseEnabledPaymentMethods = (raw: unknown): PaymentMethodId[] => {
  if (!raw) return ['cash_on_delivery'];
  if (Array.isArray(raw)) {
    const methods = raw.filter((m): m is PaymentMethodId =>
      typeof m === 'string' && ['cash_on_delivery', 'credit_card', 'digital_wallet'].includes(m)
    );
    return methods.length > 0 ? methods : ['cash_on_delivery'];
  }
  return ['cash_on_delivery'];
};

export const buildPaymentMethodOptions = (enabledMethods: PaymentMethodId[]): PaymentMethodOption[] => {
  const ids: PaymentMethodId[] = ['cash_on_delivery', 'digital_wallet', 'credit_card'];
  return ids.map((id) => {
    const meta = METHOD_META[id];
    const enabled = enabledMethods.includes(id);
    const available = enabled && !meta.gatewayRequired;
    return {
      id,
      label: meta.label,
      description: meta.description,
      enabled,
      available,
    };
  }).filter((m) => m.enabled);
};

export const getPaymentMethodLabel = (method?: string): string => {
  if (!method) return 'غير محدد';
  const key = method as PaymentMethodId;
  return METHOD_META[key]?.label || method;
};

export const getPaymentStatusLabel = (status?: string): string => {
  switch (status) {
    case 'pending_collection': return 'بانتظار التحصيل';
    case 'collected': return 'تم التحصيل';
    case 'awaiting_gateway': return 'بانتظار التحويل';
    case 'paid': return 'مدفوع';
    case 'failed': return 'فشل الدفع';
    case 'partially_refunded': return 'مسترد جزئياً';
    case 'refunded': return 'مسترد بالكامل';
    case 'disputed': return 'نزاع / chargeback';
    default: return status || 'غير معروف';
  }
};

export const mapPaymentError = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower.includes('payment_method_not_allowed')) {
    return 'طريقة الدفع المختارة غير متاحة لهذا المتجر';
  }
  if (lower.includes('refund exceeds')) {
    return 'مبلغ الاسترداد يتجاوز المبلغ المتبقي';
  }
  if (lower.includes('duplicate') || lower.includes('idempotent')) {
    return 'تمت معالجة هذه العملية مسبقاً';
  }
  return message;
};
