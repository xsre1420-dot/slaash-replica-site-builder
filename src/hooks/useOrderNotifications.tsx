import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatOrderNumber } from '@/utils/orderWorkflowUtils';
import type { OrderRealtimeEvent } from '@/hooks/useRealtimeOrders';

export type OrderNotification = {
  id: string;
  type: 'new' | 'completed' | 'cancelled' | 'payment' | 'refund' | 'failed';
  orderId: string;
  title: string;
  description: string;
  at: string;
  read: boolean;
};

const STORAGE_KEY = (ownerId: string) => `merchant-order-notifications:${ownerId}`;
const MAX_STORED = 50;

const loadStored = (ownerId: string): OrderNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(ownerId));
    if (!raw) return [];
    return JSON.parse(raw) as OrderNotification[];
  } catch {
    return [];
  }
};

const saveStored = (ownerId: string, items: OrderNotification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY(ownerId), JSON.stringify(items.slice(0, MAX_STORED)));
  } catch {
    /* ignore */
  }
};

export const eventToNotification = (event: OrderRealtimeEvent): OrderNotification | null => {
  const at = new Date().toISOString();
  const id = `${event.type}-${'orderId' in event ? event.orderId : 'refetch'}-${at}`;

  if (event.type === 'insert') {
    return {
      id,
      type: 'new',
      orderId: event.orderId,
      title: 'طلب جديد',
      description: formatOrderNumber(event.orderId),
      at,
      read: false,
    };
  }

  if (event.type === 'update') {
    if (event.status === 'completed') {
      return {
        id,
        type: 'completed',
        orderId: event.orderId,
        title: 'تم إكمال طلب',
        description: formatOrderNumber(event.orderId),
        at,
        read: false,
      };
    }
    if (event.status === 'cancelled') {
      return {
        id,
        type: 'cancelled',
        orderId: event.orderId,
        title: 'تم إلغاء طلب',
        description: formatOrderNumber(event.orderId),
        at,
        read: false,
      };
    }
    if (event.paymentStatus === 'paid' || event.paymentStatus === 'collected') {
      return {
        id,
        type: 'payment',
        orderId: event.orderId,
        title: 'تم استلام الدفع',
        description: formatOrderNumber(event.orderId),
        at,
        read: false,
      };
    }
    if (event.paymentStatus === 'refunded' || event.paymentStatus === 'partially_refunded') {
      return {
        id,
        type: 'refund',
        orderId: event.orderId,
        title: 'تحديث الاسترداد',
        description: formatOrderNumber(event.orderId),
        at,
        read: false,
      };
    }
    if (event.paymentStatus === 'failed') {
      return {
        id,
        type: 'failed',
        orderId: event.orderId,
        title: 'فشل الدفع',
        description: formatOrderNumber(event.orderId),
        at,
        read: false,
      };
    }
  }

  return null;
};

export const useOrderNotifications = (ownerId?: string) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);

  useEffect(() => {
    if (!ownerId) {
      setNotifications([]);
      return;
    }
    setNotifications(loadStored(ownerId));
  }, [ownerId]);

  const pushNotification = useCallback(
    (item: OrderNotification) => {
      if (!ownerId) return;
      setNotifications((prev) => {
        const next = [item, ...prev.filter((n) => n.id !== item.id)].slice(0, MAX_STORED);
        saveStored(ownerId, next);
        return next;
      });
    },
    [ownerId]
  );

  const markRead = useCallback(
    (id: string) => {
      if (!ownerId) return;
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        saveStored(ownerId, next);
        return next;
      });
    },
    [ownerId]
  );

  const markAllRead = useCallback(() => {
    if (!ownerId) return;
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveStored(ownerId, next);
      return next;
    });
  }, [ownerId]);

  const clearAll = useCallback(() => {
    if (!ownerId) return;
    setNotifications([]);
    saveStored(ownerId, []);
  }, [ownerId]);

  const openOrder = useCallback(
    (orderId: string, notificationId?: string) => {
      if (notificationId) markRead(notificationId);
      navigate(`/orders/${orderId}`);
    },
    [markRead, navigate]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    pushNotification,
    markRead,
    markAllRead,
    clearAll,
    openOrder,
  };
};
