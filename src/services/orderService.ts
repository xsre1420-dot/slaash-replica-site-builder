import { supabase } from '@/integrations/supabase/client';
import { Order, CartItem } from '@/types';
import { mapDbOrder } from '@/mappers/orderMapper';
import { clearCheckoutIdempotencyKey, getOrCreateIdempotencyKey } from '@/utils/checkoutSession';
import { mapOrderError } from '@/utils/orderErrors';
import { instrumentAsync, instrumentQuery, logger, metrics } from '@/lib/observability';
import type { MarketingAttribution } from '@/lib/attribution';

export const ORDERS_PER_PAGE = 50;

export const ORDER_DETAIL_SELECT =
  'id, status, total_amount, created_at, customer_name, customer_phone, customer_address, customer_governorate, notes, coupon_code, discount_amount, payment_method, payment_status, delivery_fee, delivery_status, order_items(id, product_id, product_name, product_price, quantity, subtotal, variant_metadata)';

export const ORDER_LIST_SELECT =
  'id, status, total_amount, created_at, updated_at, customer_name, customer_phone, customer_address, customer_governorate, notes, delivery_fee, delivery_status, payment_method, payment_status, coupon_code, discount_amount, order_items(id, product_id, product_name, product_price, quantity, subtotal, variant_metadata)';

const enrichOrdersWithProductImages = async (orders: Order[], ownerId: string): Promise<Order[]> => {
  if (orders.length === 0) return orders;

  const productIds = [
    ...new Set(
      orders.flatMap((order) =>
        order.items.map((item) => item.product.id).filter(Boolean)
      )
    ),
  ];

  if (productIds.length === 0) return orders;

  const { data, error } = await supabase
    .from('products')
    .select('id, image_url')
    .eq('owner_id', ownerId)
    .in('id', productIds);

  if (error || !data?.length) return orders;

  const imageByProductId = new Map(
    data.map((row) => [String(row.id), String(row.image_url || '')])
  );

  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => {
      const image =
        item.product.image ||
        imageByProductId.get(item.product.id) ||
        '/placeholder.svg';
      return {
        ...item,
        product: { ...item.product, image },
      };
    }),
  }));
};

export const fetchOrderById = async (
  orderId: string,
  ownerId: string
): Promise<Order | null> => {
  return instrumentQuery(
    'orders.fetchById',
    async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(ORDER_DETAIL_SELECT)
        .eq('id', orderId)
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (error) return { data: null, error };
      if (!data) return { data: null, error: null };
      const mapped = mapDbOrder(data as Record<string, unknown>);
      const [enriched] = await enrichOrdersWithProductImages([mapped], ownerId);
      return { data: enriched ?? null, error: null };

    },
    { orderId, ownerId }
  );
};

export const fetchOrdersPage = async (
  ownerId: string,
  page = 0,
  pageSize = ORDERS_PER_PAGE
): Promise<Order[]> => {
  return instrumentAsync('orders.fetchPage', async () => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_LIST_SELECT)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('orders.fetchPage failed', { ownerId, page, message: error.message });
      return [];
    }
    if (!data) return [];
    const mapped = data.map((row) => mapDbOrder(row as Record<string, unknown>));
    return enrichOrdersWithProductImages(mapped, ownerId);
  }, { ownerId, page, pageSize });
};

export const updateOrderStatus = async (
  orderId: string,
  ownerId: string,
  status: Order['status']
): Promise<{ success: boolean; error?: string }> => {
  const started = performance.now();
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('owner_id', ownerId);

  metrics.timing('orders.updateStatus', performance.now() - started, { status });

  if (error) {
    logger.error('orders.updateStatus.failed', { orderId, ownerId, status, message: error.message });
    return { success: false, error: mapOrderError(error.message) };
  }

  metrics.increment('orders.updateStatus.success', { status });
  return { success: true };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableOrderError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('lock') ||
    lower.includes('could not be processed') ||
    lower.includes('stock') ||
    lower.includes('connection')
  );
};

export const createOrder = async (
  order: Order,
  ownerId: string,
  paymentMethod = 'cash_on_delivery',
  couponCode?: string | null,
  storeSlug?: string | null,
  marketingAttribution?: MarketingAttribution | null
): Promise<Order> => {
  return instrumentAsync('order.create', async () => {
    const idempotencyKey = getOrCreateIdempotencyKey(ownerId);
    const maxAttempts = 3;

    const orderItems = order.items.map((item: CartItem) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      selected_size: item.selectedSize || null,
      selected_color: item.selectedColor || null,
    }));

    let lastError = 'Order creation failed';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await (supabase as any).rpc('create_order_with_stock_deduction', {
        p_order_id: order.id,
        p_owner_id: ownerId,
        p_idempotency_key: idempotencyKey,
        p_customer_name: order.customerInfo.name.trim(),
        p_customer_phone: order.customerInfo.phone.trim(),
        p_customer_address: order.customerInfo.address.trim(),
        p_total_amount: order.total,
        p_customer_governorate: order.customerInfo.governorate?.trim() || null,
        p_notes: order.customerInfo.notes?.trim() || null,
        p_items: orderItems,
        p_payment_method: paymentMethod,
        p_coupon_code: couponCode || null,
        p_store_slug: storeSlug?.trim().toLowerCase() || null,
      });

      if (!error && data?.success) {
        const orderId = data.order_id as string;

        if (marketingAttribution && storeSlug?.trim()) {
          await (supabase as any).rpc('attach_order_marketing_attribution', {
            p_order_id: orderId,
            p_store_slug: storeSlug.trim().toLowerCase(),
            p_attribution: marketingAttribution,
          });
        }

        if (storeSlug?.trim()) {
          void (supabase as any).functions
            .invoke('meta-conversions', {
              body: {
                store_slug: storeSlug.trim().toLowerCase(),
                order_id: orderId,
                value: Number(data.total_amount ?? order.total),
                currency: 'IQD',
                content_ids: order.items.map((item) => item.product.id),
                customer_phone: order.customerInfo.phone || null,
                event_source_url: typeof window !== 'undefined' ? window.location.href : null,
              },
            })
            .catch((err: unknown) => {
              logger.warn('meta-conversions.invoke.failed', {
                orderId,
                message: err instanceof Error ? err.message : String(err),
              });
            });
        }

        clearCheckoutIdempotencyKey(ownerId);
        logger.info('order.create.success', { orderId, ownerId, attempt });
        return {
          id: orderId,
          ...order,
          total: Number(data.total_amount ?? order.total),
        };
      }

      lastError = mapOrderError(error?.message || data?.error || 'Order creation failed');
      logger.warn('order.create.retry', {
        ownerId,
        attempt,
        error: lastError,
        rpcError: data?.error,
        expectedTotal: data?.expected_total,
      });

      if (attempt < maxAttempts && isRetryableOrderError(lastError)) {
        await sleep(400 * attempt);
        continue;
      }

      throw new Error(lastError);
    }

    throw new Error(lastError);
  }, { ownerId, paymentMethod, itemCount: order.items.length });
};
