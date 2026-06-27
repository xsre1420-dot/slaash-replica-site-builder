import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeMerchantOrders, type OrderRealtimeEvent } from '@/lib/merchantRealtimeHub';

export type { OrderRealtimeEvent };

export const useRealtimeOrders = (
  onChange?: () => void,
  onEvent?: (event: OrderRealtimeEvent) => void
) => {
  const { user } = useAuth();
  const onChangeRef = useRef(onChange);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onChangeRef.current = onChange;
    onEventRef.current = onEvent;
  }, [onChange, onEvent]);

  useEffect(() => {
    if (!user?.id) return;

    return subscribeMerchantOrders(
      user.id,
      () => onChangeRef.current?.(),
      (event) => onEventRef.current?.(event)
    );
  }, [user?.id]);
};
