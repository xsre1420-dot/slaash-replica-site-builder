import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CartItem, Product } from '@/types';

const mockLoadCheckoutPageBundle = vi.fn();

vi.mock('@/services/checkoutPageService', () => ({
  loadCheckoutPageBundle: (...args: unknown[]) => mockLoadCheckoutPageBundle(...args),
}));

vi.mock('@/context/CartContext', () => ({
  useCart: vi.fn(),
}));

vi.mock('@/context/StoreContext', () => ({
  useStore: vi.fn(),
}));

vi.mock('@/context/TenantStoreContext', () => ({
  useTenantStore: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useMetaPixel', () => ({
  useMetaPixel: () => ({
    trackInitiateCheckout: vi.fn(),
    trackPurchase: vi.fn(),
  }),
}));

vi.mock('@/utils/orderUtils', () => ({
  saveOrderToDatabase: vi.fn(),
}));

vi.mock('@/services/checkoutRecoveryService', () => ({
  tryRecoverCheckoutOrder: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/deliveryService', () => ({
  fetchDeliveryFee: vi.fn().mockResolvedValue(0),
  fetchDeliveryFeeBySlug: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/services/storefrontProductService', () => ({
  resolveStoreSlugByOwnerId: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metrics: { increment: vi.fn() },
  reportError: vi.fn(),
  alertOnError: vi.fn(),
  recordHealthEvent: vi.fn(),
}));

vi.mock('@/lib/tracing', () => ({
  traceCriticalFlow: (_name: string, _layer: string, _op: string, fn: (span: { setAttribute: () => void }) => unknown) =>
    fn({ setAttribute: vi.fn() }),
}));

vi.mock('@/lib/cache', () => ({
  flushOwnerCache: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { useCheckoutFlow } from '@/hooks/useCheckoutFlow';
import { useCart } from '@/context/CartContext';
import { useStore } from '@/context/StoreContext';
import { useTenantStore } from '@/context/TenantStoreContext';
import { useAuth } from '@/context/AuthContext';

const product = (id: string): Product => ({
  id,
  name: `Product ${id}`,
  description: '',
  category: 'general',
  price: 100,
  image: '',
  stockQuantity: 5,
});

const cartItem: CartItem = { product: product('p1'), quantity: 1 };

function renderCheckoutHook(path = '/store/demo/checkout') {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/store/:username/checkout" element={children} />
        <Route path="/checkout" element={children} />
      </Routes>
    </MemoryRouter>
  );

  return renderHook(() => useCheckoutFlow(), { wrapper });
}

describe('useCheckoutFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      resetPassword: vi.fn(),
    } as ReturnType<typeof useAuth>);

    vi.mocked(useStore).mockReturnValue({
      storeSettings: {
        paymentMethods: ['cash_on_delivery'],
        deliveryPrices: [],
      },
    } as ReturnType<typeof useStore>);

    vi.mocked(useTenantStore).mockReturnValue({
      storeInfo: {
        ownerId: 'owner-1',
        storeSlug: 'demo',
        paymentMethods: ['cash_on_delivery'],
        deliveryPrices: [],
      },
      products: [],
      categories: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockLoadCheckoutPageBundle.mockResolvedValue({
      init: {
        ownerId: 'owner-1',
        storeSlug: 'demo',
        paymentMethods: ['cash_on_delivery'],
        deliveryPrices: [],
      },
      freshProducts: new Map([[cartItem.product.id, cartItem.product]]),
    });
  });

  it('renders with a non-empty cart without throwing (cartFingerprint TDZ regression)', async () => {
    vi.mocked(useCart).mockReturnValue({
      cartItems: [cartItem],
      replaceCartItems: vi.fn(),
      clearCart: vi.fn(),
      cartTotal: 100,
      cartCount: 1,
      storeOwnerId: 'owner-1',
      setStoreOwner: vi.fn(),
    } as ReturnType<typeof useCart>);

    const { result } = renderCheckoutHook();

    await waitFor(() => {
      expect(result.current.checkoutPageReady).toBe(true);
    });

    expect(mockLoadCheckoutPageBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        storeSlug: 'demo',
        productIds: ['p1'],
        cartKey: expect.any(String),
      })
    );
  });

  it('skips bundle reload when cart fingerprint is unchanged', async () => {
    const replaceCartItems = vi.fn();
    vi.mocked(useCart).mockReturnValue({
      cartItems: [cartItem],
      replaceCartItems,
      clearCart: vi.fn(),
      cartTotal: 100,
      cartCount: 1,
      storeOwnerId: 'owner-1',
      setStoreOwner: vi.fn(),
    } as ReturnType<typeof useCart>);

    const { rerender } = renderCheckoutHook();

    await waitFor(() => {
      expect(mockLoadCheckoutPageBundle).toHaveBeenCalledTimes(1);
    });

    rerender();

    await waitFor(() => {
      expect(mockLoadCheckoutPageBundle).toHaveBeenCalledTimes(1);
    });
  });
});
