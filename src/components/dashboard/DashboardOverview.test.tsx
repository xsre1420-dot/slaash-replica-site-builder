import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

vi.mock('@/hooks/useRecentOrders', () => ({
  useRecentOrders: () => ({
    orders: [
      {
        id: '1',
        status: 'pending',
        total: 100,
        date: new Date().toISOString(),
        customerInfo: { name: 'عميل', phone: '0770000000', address: 'بغداد', governorate: 'بغداد' },
      },
    ],
    loading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOrders', () => ({
  useOrders: () => ({
    orders: [
      {
        id: '1',
        status: 'pending',
        total: 100,
        date: new Date().toISOString(),
        customerInfo: { name: 'عميل', phone: '0770000000', address: 'بغداد', governorate: 'بغداد' },
      },
    ],
    loading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDashboardInsights', () => ({
  useDashboardInsights: () => ({
    actions: [
      {
        id: 'pending-orders',
        title: '2 طلبات تحتاج المعالجة',
        description: 'راجع الطلبات وحدّث حالتها',
        href: '/orders?attention=pending-orders',
        icon: () => null,
      },
      {
        id: 'pending-reviews',
        title: '2 تقييمات بانتظار المعالجة',
        description: 'راجع التعليقات ووافق على ما يناسب متجرك',
        href: '/products?attention=pending-reviews',
        icon: () => null,
      },
      {
        id: 'low-stock',
        title: 'مخزون منخفض',
        description: '1 نفد · 2 منخفض',
        href: '/inventory?attention=low-stock',
        icon: () => null,
      },
    ],
    today: { orders: 1, revenue: 50000, visits: 12 },
    yesterday: { orders: 0, revenue: 0, visits: 8 },
    week: { orders: 1, revenue: 50000, visits: 5 },
    previousWeek: { orders: 0, revenue: 0, visits: 2 },
    lowStockCount: 3,
    inventoryOutCount: 1,
    pendingOrdersCount: 2,
    pendingReviewsCount: 2,
    loading: false,
  }),
}));

vi.mock('@/hooks/useRealtimeOrders', () => ({
  useRealtimeOrders: vi.fn(),
}));

vi.mock('@/hooks/useRealtimeProducts', () => ({
  useRealtimeProducts: vi.fn(),
}));

describe('DashboardOverview', () => {
  it('renders action items and performance KPIs', () => {
    render(
      <MemoryRouter>
        <DashboardOverview />
      </MemoryRouter>
    );

    expect(screen.getByText('يحتاج انتباهك')).toBeInTheDocument();
    expect(screen.getByText('2 طلبات تحتاج المعالجة')).toBeInTheDocument();
    expect(screen.getByText('2 تقييمات بانتظار المعالجة')).toBeInTheDocument();
    expect(screen.getByText('مخزون منخفض')).toBeInTheDocument();
    expect(screen.getByText('ملخص اليوم')).toBeInTheDocument();
    expect(screen.getByText('مبيعات اليوم (د.ع)')).toBeInTheDocument();
    expect(screen.getByText('زوار اليوم')).toBeInTheDocument();
    expect(screen.getAllByText(/طلبات تحتاج المعالجة/).length).toBe(1);
    expect(screen.getByText('الطلبات الجديدة')).toBeInTheDocument();
  });
});
