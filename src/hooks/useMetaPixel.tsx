import { useCallback } from 'react';
import {
  trackGoogleEvent,
  trackMetaEvent,
} from '@/lib/marketingTracking';
import {
  buildAddPaymentInfo,
  buildAddToCart,
  buildAddToWishlist,
  buildCompleteRegistration,
  buildContact,
  buildInitiateCheckout,
  buildLead,
  buildPurchase,
  buildSearch,
  buildViewContent,
} from '@/lib/meta/standardEvents';

function fireBuilt(
  built: {
    event: string;
    data: Record<string, unknown>;
    options: { eventId: string; eventSourceUrl?: string };
  },
  gaEvent?: string
): void {
  trackMetaEvent(built.event, built.data, { eventId: built.options.eventId, eventSourceUrl: built.options.eventSourceUrl });
  trackGoogleEvent(gaEvent ?? built.event.toLowerCase(), {
    ...built.data,
    event_id: built.options.eventId,
  });
}

export const useMetaPixel = () => {
  const trackViewContent = useCallback((productId: string, productName: string, value?: number) => {
    fireBuilt(buildViewContent(productId, productName, value), 'view_item');
  }, []);

  const trackSearch = useCallback((searchString: string) => {
    fireBuilt(buildSearch(searchString), 'search');
  }, []);

  const trackAddToWishlist = useCallback((productId: string, productName: string, value: number) => {
    fireBuilt(buildAddToWishlist(productId, productName, value), 'add_to_wishlist');
  }, []);

  const trackAddToCart = useCallback((productId: string, productName: string, value: number, quantity = 1) => {
    fireBuilt(buildAddToCart(productId, productName, value, quantity), 'add_to_cart');
  }, []);

  const trackInitiateCheckout = useCallback((value: number, productIds: string[]) => {
    fireBuilt(buildInitiateCheckout(value, productIds), 'begin_checkout');
  }, []);

  const trackAddPaymentInfo = useCallback((value: number, productIds: string[]) => {
    fireBuilt(buildAddPaymentInfo(value, productIds), 'add_payment_info');
  }, []);

  const trackPurchase = useCallback((value: number, orderItems: string[], orderId: string) => {
    const built = buildPurchase(value, orderItems, orderId);
    trackMetaEvent(built.event, built.data, built.options);
    trackGoogleEvent('purchase', {
      transaction_id: orderId,
      value,
      currency: 'IQD',
      items: orderItems.map((id) => ({ item_id: id })),
      event_id: built.options.eventId,
    });
  }, []);

  const trackLead = useCallback(() => {
    fireBuilt(buildLead(), 'generate_lead');
  }, []);

  const trackContact = useCallback(() => {
    fireBuilt(buildContact(), 'contact');
  }, []);

  const trackCompleteRegistration = useCallback(() => {
    fireBuilt(buildCompleteRegistration(), 'sign_up');
  }, []);

  return {
    trackViewContent,
    trackSearch,
    trackAddToWishlist,
    trackAddToCart,
    trackInitiateCheckout,
    trackAddPaymentInfo,
    trackPurchase,
    trackLead,
    trackContact,
    trackCompleteRegistration,
  };
};
