import { createMetaEventId, purchaseEventId } from '@/lib/meta/eventIds';
import type { MetaEventCustomData, MetaStandardEventName, MetaTrackOptions } from '@/lib/meta/types';

const DEFAULT_CURRENCY = 'IQD';

export interface StandardEventInput {
  eventId?: string;
  eventSourceUrl?: string;
}

export function buildViewContent(
  productId: string,
  productName: string,
  value?: number,
  opts?: StandardEventInput
): { event: MetaStandardEventName; data: MetaEventCustomData; options: MetaTrackOptions } {
  return {
    event: 'ViewContent',
    data: {
      content_ids: [productId],
      content_type: 'product',
      content_name: productName,
      value,
      currency: DEFAULT_CURRENCY,
    },
    options: {
      eventId: opts?.eventId ?? createMetaEventId('view'),
      eventSourceUrl: opts?.eventSourceUrl,
    },
  };
}

export function buildSearch(
  searchString: string,
  opts?: StandardEventInput
): { event: MetaStandardEventName; data: MetaEventCustomData; options: MetaTrackOptions } {
  return {
    event: 'Search',
    data: { search_string: searchString, content_type: 'product' },
    options: { eventId: opts?.eventId ?? createMetaEventId('search'), eventSourceUrl: opts?.eventSourceUrl },
  };
}

export function buildAddToWishlist(
  productId: string,
  productName: string,
  value: number,
  opts?: StandardEventInput
): { event: MetaStandardEventName; data: MetaEventCustomData; options: MetaTrackOptions } {
  return {
    event: 'AddToWishlist',
    data: {
      content_ids: [productId],
      content_type: 'product',
      content_name: productName,
      value,
      currency: DEFAULT_CURRENCY,
    },
    options: { eventId: opts?.eventId ?? createMetaEventId('wishlist'), eventSourceUrl: opts?.eventSourceUrl },
  };
}

export function buildAddToCart(
  productId: string,
  productName: string,
  value: number,
  quantity = 1,
  opts?: StandardEventInput
): { event: MetaStandardEventName; data: MetaEventCustomData; options: MetaTrackOptions } {
  return {
    event: 'AddToCart',
    data: {
      content_ids: [productId],
      content_type: 'product',
      content_name: productName,
      value,
      currency: DEFAULT_CURRENCY,
      num_items: quantity,
      contents: [{ id: productId, quantity, item_price: value / Math.max(quantity, 1) }],
    },
    options: { eventId: opts?.eventId ?? createMetaEventId('cart'), eventSourceUrl: opts?.eventSourceUrl },
  };
}

export function buildInitiateCheckout(
  value: number,
  productIds: string[],
  opts?: StandardEventInput
): { event: MetaStandardEventName; data: MetaEventCustomData; options: MetaTrackOptions } {
  return {
    event: 'InitiateCheckout',
    data: {
      content_ids: productIds,
      content_type: 'product',
      value,
      currency: DEFAULT_CURRENCY,
      num_items: productIds.length,
    },
    options: { eventId: opts?.eventId ?? createMetaEventId('checkout'), eventSourceUrl: opts?.eventSourceUrl },
  };
}

export function buildAddPaymentInfo(
  value: number,
  productIds: string[],
  opts?: StandardEventInput
): { event: MetaStandardEventName; data: MetaEventCustomData; options: MetaTrackOptions } {
  return {
    event: 'AddPaymentInfo',
    data: {
      content_ids: productIds,
      content_type: 'product',
      value,
      currency: DEFAULT_CURRENCY,
      num_items: productIds.length,
    },
    options: { eventId: opts?.eventId ?? createMetaEventId('payment'), eventSourceUrl: opts?.eventSourceUrl },
  };
}

export function buildPurchase(
  value: number,
  productIds: string[],
  orderId: string,
  opts?: StandardEventInput
): { event: MetaStandardEventName; data: MetaEventCustomData; options: MetaTrackOptions } {
  return {
    event: 'Purchase',
    data: {
      content_ids: productIds,
      content_type: 'product',
      value,
      currency: DEFAULT_CURRENCY,
      num_items: productIds.length,
      contents: productIds.map((id) => ({ id, quantity: 1 })),
    },
    options: {
      eventId: opts?.eventId ?? purchaseEventId(orderId),
      eventSourceUrl: opts?.eventSourceUrl,
    },
  };
}

export function buildLead(opts?: StandardEventInput): {
  event: MetaStandardEventName;
  data: MetaEventCustomData;
  options: MetaTrackOptions;
} {
  return {
    event: 'Lead',
    data: { content_type: 'lead' },
    options: { eventId: opts?.eventId ?? createMetaEventId('lead'), eventSourceUrl: opts?.eventSourceUrl },
  };
}

export function buildContact(opts?: StandardEventInput): {
  event: MetaStandardEventName;
  data: MetaEventCustomData;
  options: MetaTrackOptions;
} {
  return {
    event: 'Contact',
    data: { content_type: 'contact' },
    options: { eventId: opts?.eventId ?? createMetaEventId('contact'), eventSourceUrl: opts?.eventSourceUrl },
  };
}

export function buildCompleteRegistration(opts?: StandardEventInput): {
  event: MetaStandardEventName;
  data: MetaEventCustomData;
  options: MetaTrackOptions;
} {
  return {
    event: 'CompleteRegistration',
    data: { status: true },
    options: { eventId: opts?.eventId ?? createMetaEventId('reg'), eventSourceUrl: opts?.eventSourceUrl },
  };
}
