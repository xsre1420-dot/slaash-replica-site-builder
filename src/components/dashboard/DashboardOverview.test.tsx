import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

vi.mock('@/hooks/useOrders', () => ({
  useOrders: () => ({
    orders: [
      {
        id: '1',
        status: 'pending',
        total: 100,
        date: '2026-06-14T10:00:00Z',
        customerInfo: { name: 'عميل', phone: '0770000000', address: 'بغداد', governorate: 'بغداد' },
      },
    ],
    loading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOrderDashboardStats', () => ({
  useOrderDashboardStats: () => ({
    stats: {
      total: 1,
      newOrders: 1,
      pendingFulfillment: 1,
      delivered: 0,
      revenue: 0,
    },
    statsLoading: false,
    reloadStats: vi.fn(),
  }),
}));

vi.mock('@/hooks/useRealtimeOrders', () => ({
  useRealtimeOrders: vi.fn(),
}));

vi.mock('@/services/productService', () => ({
  getProductsSync: () => [{ id: 'p1' }],
}));

describe('DashboardOverview', () => {
  it('renders without crashing when useOrders returns orders', () => {
    render(
      <MemoryRouter>
        <DashboardOverview />
      </MemoryRouter>
    );

    expect(screen.queryByText('حدث خطأ غير متوقع')).not.toBeInTheDocument();
    expect(screen.getByText('ملخص المتجر')).toBeInTheDocument();
    expect(screen.getAllByText('قيد الانتظار').length).toBeGreaterThan(0);
  });
});
