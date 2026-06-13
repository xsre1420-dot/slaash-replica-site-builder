import { useCallback } from 'react';
import { trackGoogleEvent, trackMetaEvent, type MetaEventPayload } from '@/lib/marketingTracking';

export const useMetaPixel = () => {
  const trackEvent = useCallback((event: string, data?: MetaEventPayload) => {
    trackMetaEvent(event, data);
    trackGoogleEvent(event.toLowerCase(), data as Record<string, unknown> | undefined);
  }, []);

  const trackViewContent = useCallback((productId: string, productName: string, value?: number) => {
    trackEvent('ViewContent', {
      content_ids: [productId],
      content_type: 'product',
      content_name: productName,
      value,
      currency: 'IQD',
    });
  }, [trackEvent]);

  const trackAddToCart = useCallback((productId: string, productName: string, value: number) => {
    trackEvent('AddToCart', {
      content_ids: [productId],
      content_type: 'product',
      content_name: productName,
      value,
      currency: 'IQD',
    });
  }, [trackEvent]);

  const trackInitiateCheckout = useCallback((value: number, productIds: string[]) => {
    trackEvent('InitiateCheckout', {
      content_ids: productIds,
      content_type: 'product',
      value,
      currency: 'IQD',
      num_items: productIds.length,
    });
  }, [trackEvent]);

  const trackPurchase = useCallback((value: number, orderItems: string[], orderId?: string) => {
    trackEvent('Purchase', {
      content_ids: orderItems,
      content_type: 'product',
      value,
      currency: 'IQD',
      num_items: orderItems.length,
      eventID: orderId,
    });
    trackGoogleEvent('purchase', {
      transaction_id: orderId,
      value,
      currency: 'IQD',
      items: orderItems.map((id) => ({ item_id: id })),
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackViewContent,
    trackAddToCart,
    trackInitiateCheckout,
    trackPurchase,
  };
};
