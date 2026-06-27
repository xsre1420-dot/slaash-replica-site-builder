import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { subscribeMerchantProducts } from '@/lib/merchantRealtimeHub';

/** Subscribe to merchant product changes; cache patching runs once in the shared hub. */
export const useRealtimeProducts = (onUpdate?: () => void) => {
  const { user } = useAuth();
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!user?.id) return;
    return subscribeMerchantProducts(user.id, () => onUpdateRef.current?.());
  }, [user?.id]);
};
