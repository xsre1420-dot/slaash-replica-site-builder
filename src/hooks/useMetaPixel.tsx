import { useCallback } from 'react';

interface MetaPixelEventData {
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
  content_name?: string;
}

export const useMetaPixel = () => {
  const trackEvent = useCallback((event: string, data?: MetaPixelEventData) => {
    if (typeof window !== 'undefined' && window.fbq) {
      if (data) {
        window.fbq('track', event, data);
      } else {
        window.fbq('track', event);
      }
    }
  }, []);

  const trackViewContent = useCallback((productId: string, productName: string, value?: number) => {
    trackEvent('ViewContent', {
      content_ids: [productId],
      content_type: 'product',
      content_name: productName,
      value: value,
      currency: 'IQD'
    });
  }, [trackEvent]);

  const trackAddToCart = useCallback((productId: string, productName: string, value: number) => {
    trackEvent('AddToCart', {
      content_ids: [productId],
      content_type: 'product',
      content_name: productName,
      value: value,
      currency: 'IQD'
    });
  }, [trackEvent]);

  const trackPurchase = useCallback((value: number, orderItems: string[]) => {
    trackEvent('Purchase', {
      content_ids: orderItems,
      content_type: 'product',
      value: value,
      currency: 'IQD'
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackViewContent,
    trackAddToCart,
    trackPurchase
  };
};