/**
 * Order write commands — primary DB only. No list/query reads.
 */
import { Order, CartItem } from '@/types';
import { getOrCreateIdempotencyKey } from '@/utils/checkoutSession';
import { tryRecoverCheckoutOrder } from '@/services/checkoutRecoveryService';
import { mapOrderRpcFailure, mapOrderError } from '@/utils/orderErrors';
import { flushOrderCache } from '@/lib/cache';
import { instrumentAsync, logger, metrics } from '@/lib/observability';
import { recordHealthEvent } from '@/lib/observability/healthMonitor';
import {
  enforceRateLimit,
  formatRateLimitMessageAr,
  RATE_LIMITS,
  RateLimitExceededError,
} from '@/lib/security/rateLimiter';
import type { MarketingAttribution } from '@/lib/attribution';
import { getMetaBrowserContext } from '@/lib/meta/cookies';
import { purchaseEventId } from '@/lib/meta/eventIds';
import { buildMetaPurchaseContents } from '@/lib/meta/purchasePayload';
import { enqueueCacheInvalidation, enqueueMetaConversion } from '@/background/enqueue';
import { assertMerchantOwner } from '@/lib/tenantGuard';
import {
  rpcUpdateMerchantOrderStatus,
  rpcCreateOrderWithStockDeduction,
  rpcAttachOrderMarketingAttribution,
} from '@/repositories/orders/orderRepository';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const inflightOrders = new Map<string, Promise<CreateOrderResult>>();

export type CreateOrderResult = Order & { wasIdempotent?: boolean };

/** @internal test helper */
export const clearInflightOrdersForTests = (): void => {
  inflightOrders.clear();
};

const isRetryableOrderError = (message: string): boolean => {
  const lower = message.toLowerCase();
  if (
    lower.includes('insufficient stock') ||
    lower.includes('stock_deduction_failed') ||
    lower.includes('total_amount_mismatch') ||
    lower.includes('rate_limited') ||
    message.includes('غير متوفر') ||
    message.includes('مخزون')
  ) {
    return false;
  }
  return (
    lower.includes('timeout') ||
    lower.includes('lock') ||
    lower.includes('could not be processed') ||
    lower.includes('connection') ||
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('aborted') ||
    lower.includes('econnreset') ||
    lower.includes('socket') ||
    lower.includes('temporarily unavailable')
  );
};

const buildRecoveredOrderResult = (
  order: Order,
  recovered: { orderId: string; totalAmount: number }
): CreateOrderResult => ({
  ...order,
  id: recovered.orderId,
  total: recovered.totalAmount,
  wasIdempotent: true,
});

import { findProductColorOption } from '@/utils/orderItemDisplayUtils';

const normalizeOrderRpcItems = (items: CartItem[]) =>
  items.map((item) => {
    const colorOpt = findProductColorOption(item.product.colors, item.selectedColor);
    return {
      product_id: item.product.id,
      quantity: item.quantity,
      selected_size: item.selectedSize?.trim() || null,
      selected_color: item.selectedColor?.trim() || null,
      color_name: item.selectedColorName ?? colorOpt?.name ?? null,
      color_image: item.selectedColorImage ?? colorOpt?.image ?? null,
    };
  });

export const updateOrderStatus = async (
  orderId: string,
  ownerId: string,
  status: Order['status']
): Promise<{ success: boolean; error?: string }> => {
  await assertMerchantOwner(ownerId);
  const started = performance.now();

  const { data, error } = await rpcUpdateMerchantOrderStatus({
    p_order_id: orderId,
    p_owner_id: ownerId,
    p_status: status,
  });

  metrics.timing('orders.updateStatus', performance.now() - started, { status });

  if (error) {
    logger.error('orders.updateStatus.failed', { orderId, ownerId, status, message: error.message });
    return { success: false, error: mapOrderError(error.message) };
  }

  if (data?.success === false) {
    const rpcError = String(data?.error ?? 'status_update_failed');
    logger.error('orders.updateStatus.rpc_rejected', { orderId, ownerId, status, error: rpcError });
    return { success: false, error: mapOrderError(rpcError) };
  }

  metrics.increment('orders.updateStatus.success', { status, noop: data?.noop === true ? 'true' : 'false' });
  return { success: true };
};

export const createOrder = async (
  order: Order,
  ownerId: string,
  paymentMethod = 'cash_on_delivery',
  couponCode?: string | null,
  storeSlug?: string | null,
  marketingAttribution?: MarketingAttribution | null
): Promise<CreateOrderResult> => {
  const idempotencyKey = getOrCreateIdempotencyKey(ownerId);
  const inflightKey = `${ownerId}:${idempotencyKey}`;
  const existing = inflightOrders.get(inflightKey);
  if (existing) return existing;

  const promise = instrumentAsync('order.create', async () => {
    try {
      enforceRateLimit(`checkout:${ownerId}`, RATE_LIMITS.checkout);
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        throw new Error(formatRateLimitMessageAr(err.retryAfterMs));
      }
      throw err;
    }

    const maxAttempts = 3;
    const orderItems = normalizeOrderRpcItems(order.items);
    let submitTotal = order.total;
    let lastError = 'Order creation failed';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error } = await rpcCreateOrderWithStockDeduction({
        p_order_id: order.id,
        p_owner_id: ownerId,
        p_idempotency_key: idempotencyKey,
        p_customer_name: order.customerInfo.name.trim(),
        p_customer_phone: order.customerInfo.phone.trim(),
        p_customer_address: order.customerInfo.address.trim(),
        p_total_amount: submitTotal,
        p_customer_governorate: order.customerInfo.governorate?.trim() || null,
        p_notes: order.customerInfo.notes?.trim() || null,
        p_items: orderItems,
        p_payment_method: paymentMethod,
        p_coupon_code: couponCode || null,
        p_store_slug: storeSlug?.trim().toLowerCase() || null,
      });

      if (!error && data?.success) {
        const orderId = data.order_id as string;
        const wasIdempotent = data.idempotent === true;

        if (wasIdempotent) {
          logger.info('order.create.idempotent', { orderId, ownerId, attempt });
          metrics.increment('checkout.submit.idempotent');
        }

        if (marketingAttribution && storeSlug?.trim() && !wasIdempotent) {
          await rpcAttachOrderMarketingAttribution({
            p_order_id: orderId,
            p_store_slug: storeSlug.trim().toLowerCase(),
            p_attribution: marketingAttribution,
          });
        }

        if (storeSlug?.trim() && !wasIdempotent) {
          const metaCtx = typeof window !== 'undefined' ? getMetaBrowserContext(storeSlug) : { fbp: null, fbc: null, eventSourceUrl: null };
          const purchaseLines = buildMetaPurchaseContents(
            order.items.map((item) => ({ productId: item.product.id, quantity: item.quantity }))
          );
          enqueueMetaConversion({
            storeSlug: storeSlug.trim().toLowerCase(),
            orderId,
            eventId: purchaseEventId(orderId),
            value: Number(data.total_amount ?? order.total),
            currency: 'IQD',
            contentIds: purchaseLines.contentIds,
            contents: purchaseLines.contents,
            numItems: purchaseLines.numItems,
            customerPhone: order.customerInfo.phone || null,
            customerName: order.customerInfo.name?.trim() || null,
            customerGovernorate: order.customerInfo.governorate?.trim() || null,
            externalId: orderId,
            eventSourceUrl: metaCtx.eventSourceUrl || null,
            fbp: metaCtx.fbp,
            fbc: metaCtx.fbc,
          });
        }

        logger.info('order.create.success', { orderId, ownerId, attempt, wasIdempotent });
        recordHealthEvent('order', true);
        if (!wasIdempotent) {
          void import('@/lib/monitoring/instrumentation').then(({ recordBusinessEvent }) => {
            recordBusinessEvent('order_created');
          });
          flushOrderCache(ownerId);
          enqueueCacheInvalidation(ownerId, 'full', { bumpVersion: true });
        }
        return {
          ...order,
          id: orderId,
          total: Number(data.total_amount ?? order.total),
          wasIdempotent,
        };
      }

      if (error) {
        lastError = mapOrderRpcFailure({ error: error.message });
        logger.warn('order.create.rpc_transport_error', { ownerId, attempt, error: error.message });

        if (attempt < maxAttempts && isRetryableOrderError(lastError)) {
          await sleep(400 * attempt);
          continue;
        }

        const recovered = await tryRecoverCheckoutOrder(ownerId, storeSlug);
        if (recovered) {
          logger.info('order.create.recovered_after_transport_error', {
            orderId: recovered.orderId,
            ownerId,
            attempt,
          });
          metrics.increment('checkout.submit.recovered');
          return buildRecoveredOrderResult(order, recovered);
        }

        throw new Error(lastError);
      }

      if (
        data?.error === 'total_amount_mismatch' &&
        data?.expected_total != null &&
        attempt < maxAttempts
      ) {
        submitTotal = Number(data.expected_total);
        logger.warn('order.create.total_mismatch_retry', {
          ownerId,
          attempt,
          expectedTotal: submitTotal,
          receivedTotal: order.total,
        });
        await sleep(200);
        continue;
      }

      lastError = mapOrderRpcFailure(data ?? { error: error?.message });
      logger.warn('order.create.retry', {
        ownerId,
        attempt,
        error: lastError,
        rpcError: data?.error,
        productName: data?.product_name,
        expectedTotal: data?.expected_total,
        receivedTotal: order.total,
      });

      if (attempt < maxAttempts && isRetryableOrderError(lastError)) {
        await sleep(400 * attempt);
        continue;
      }

      recordHealthEvent('order', false, { message: lastError });
      throw new Error(lastError);
    }

    const recovered = await tryRecoverCheckoutOrder(ownerId, storeSlug);
    if (recovered) {
      logger.info('order.create.recovered_after_retries', { orderId: recovered.orderId, ownerId });
      metrics.increment('checkout.submit.recovered');
      return buildRecoveredOrderResult(order, recovered);
    }

    recordHealthEvent('order', false, { message: lastError });
    throw new Error(lastError);
  }, { ownerId, paymentMethod, itemCount: order.items.length });

  inflightOrders.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    inflightOrders.delete(inflightKey);
  }
};
